const axios = require('axios');

/**
 * Calculates string similarity using a basic matching logic.
 * Checks if one string is contained within the other after normalizing.
 */
function isSimilar(str1, str2) {
  if (!str1 || !str2) return false;
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (s1 === s2) return true;
  if (s1.includes(s2) && s2.length > 3) return true;
  if (s2.includes(s1) && s1.length > 3) return true;
  return false;
}

let cachedProviders = [];
let lastFetchTime = 0;

async function getAvailableProviders() {
  const now = Date.now();
  // Cache for 10 minutes
  if (cachedProviders.length > 0 && (now - lastFetchTime) < 10 * 60 * 1000) {
    return cachedProviders;
  }
  try {
    const response = await axios.get(process.env.PROVIDER_URL + '/providers', { timeout: 5000 });
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      cachedProviders = response.data;
      lastFetchTime = now;
      return cachedProviders;
    }
  } catch (error) {
    console.error('[ProviderService Error] Failed to fetch providers list dynamically:', error.message);
  }
  
  // Fallback if the API fails
  if (cachedProviders.length > 0) return cachedProviders;
  return ['vega', 'dooflix', 'hdhub4u', 'luxMovies'];
}

/**
 * Fetches intermediate streaming links from the local provider microservice
 * and attaches them to the movieData object before saving to MongoDB.
 * Implements Double Verification logic using IMDb ID and fallback string similarity.
 * @param {Object} movieData - The movie data mapped from scraper
 * @returns {Object} The updated movie data
 */
async function fetchAndAttachProviderLinks(movieData) {
  try {
    const movieName = movieData.title || movieData.original_title;
    if (!movieName) return movieData;

    const targetImdbId = movieData.imdb_id;
    let targetYear = '';
    if (movieData.release_date && typeof movieData.release_date === 'string') {
      targetYear = movieData.release_date.substring(0, 4);
    } else if (movieData.year) {
      targetYear = String(movieData.year);
    }

    // Dynamic Content Type Logic
    let isSeries = false;
    const titleType = (movieData.title_type || '').toLowerCase();
    if (titleType.includes('tv') || titleType.includes('series') || titleType.includes('episode')) {
      isSeries = true;
    }
    const contentType = isSeries ? 'tv' : 'movie';

    console.log(`[ProviderService] Fetching links for: ${movieName} (${targetImdbId}) - Content Type: ${contentType}`);
    
    // Dynamically fetch ALL available providers from the provider service
    const PROVIDERS = await getAvailableProviders();
    console.log(`[ProviderService] Will attempt ${PROVIDERS.length} providers: ${PROVIDERS.join(', ')}`);

    // Multi-Provider Fallback Logic
    for (const provider of PROVIDERS) {
      try {
        console.log(`[ProviderService] Trying provider: ${provider}`);
        // Call 1: Search provider for the movie
        // Added type to search URL to support providers that handle movies/series differently
        const searchUrl = `${process.env.PROVIDER_URL}/api/${provider}/search?q=${encodeURIComponent(movieName)}&type=${contentType}`;
        const searchResponse = await axios.get(searchUrl, { timeout: 30000 });
        
        // Check if we have valid results
        if (searchResponse.data && Array.isArray(searchResponse.data) && searchResponse.data.length > 0) {
          // Take first 5 results to process in parallel
          const topResults = searchResponse.data.slice(0, 5);
          
          // Call 2: Send links to get metadata IN PARALLEL
          const metaPromises = topResults.map(async (result) => {
            if (!result.link) return null;
            try {
              const metaUrl = `${process.env.PROVIDER_URL}/api/${provider}/meta?link=${encodeURIComponent(result.link)}`;
              const metaResponse = await axios.get(metaUrl, { timeout: 30000 });
              return {
                searchResult: result,
                metaData: metaResponse.data
              };
            } catch (err) {
              // Suppress individual errors so Promise.all can proceed
              return null;
            }
          });

          // Wait for all parallel requests to complete
          const metaResponses = await Promise.all(metaPromises);
          
          let matchedMeta = null;

          // First Pass: Strict IMDb ID match
          if (targetImdbId) {
            matchedMeta = metaResponses.find(res => {
               return res && res.metaData && res.metaData.imdbId === targetImdbId;
            });
            if (matchedMeta) {
              console.log(`[ProviderService] [${provider}] Double Verification Passed: Exact IMDb ID match (${targetImdbId})`);
            }
          }

          // Second Pass: Fallback Logic (Title + Year similarity)
          if (!matchedMeta) {
            matchedMeta = metaResponses.find(res => {
               if (!res) return false;
               
               const providerTitle = (res.metaData && res.metaData.title) || res.searchResult.title || res.searchResult.name || '';
               const providerYear = (res.metaData && res.metaData.year) || res.searchResult.year || '';
               
               const titleMatch = isSimilar(movieName, providerTitle);
               
               let yearMatch = true;
               if (targetYear && providerYear) {
                 const tYear = parseInt(targetYear, 10);
                 const pYear = parseInt(providerYear, 10);
                 if (!isNaN(tYear) && !isNaN(pYear)) {
                   yearMatch = Math.abs(tYear - pYear) <= 1; // Allow ±1 year difference
                 }
               }

               if (titleMatch && yearMatch) {
                   console.log(`[ProviderService] [${provider}] Fallback match found: Title "${providerTitle}" & Year "${providerYear}"`);
                   return true;
               }
               return false;
            });
          }
          
          if (matchedMeta && matchedMeta.metaData && Array.isArray(matchedMeta.metaData.linkList)) {
            const links = matchedMeta.metaData.linkList;
            
            if (isSeries) {
              // TV Series Flow
              const episodesLinkItem = links.find(item => item.episodesLink);
              if (episodesLinkItem) {
                console.log(`[ProviderService] [${provider}] Found episodesLink. Fetching episodes...`);
                try {
                  const episodesUrl = `${process.env.PROVIDER_URL}/api/${provider}/episodes?link=${encodeURIComponent(episodesLinkItem.episodesLink)}`;
                  const episodesResponse = await axios.get(episodesUrl, { timeout: 15000 });
                  
                  if (episodesResponse.data && Array.isArray(episodesResponse.data)) {
                    const rawEpisodes = episodesResponse.data;
                    const seasonsMap = {};
                    
                    rawEpisodes.forEach((ep, idx) => {
                      let sNum = 1;
                      let eNum = idx + 1;
                      
                      const match = ep.title.match(/S(\d+)[\sE]*(\d+)/i) || ep.title.match(/Season\s*(\d+)[\s-]*Episode\s*(\d+)/i) || ep.title.match(/S(\d+)/i);
                      if (match) {
                        sNum = parseInt(match[1], 10);
                        if (match[2]) {
                          eNum = parseInt(match[2], 10);
                        }
                      }
                      
                      if (!seasonsMap[sNum]) {
                        seasonsMap[sNum] = { season_number: sNum, episodes: [] };
                      }
                      
                      let epLink = "";
                      if (typeof ep.link === 'string') {
                          epLink = ep.link;
                      } else if (ep.url) {
                          epLink = ep.url;
                      } else {
                          epLink = JSON.stringify(ep.link); // Fallback
                      }

                      seasonsMap[sNum].episodes.push({
                        episode_number: eNum,
                        title: ep.title || `Episode ${eNum}`,
                        link: epLink
                      });
                    });
                    
                    movieData.seasons = Object.values(seasonsMap);
                    movieData.provider_name = provider;
                    console.log(`[ProviderService] [${provider}] Extracted ${rawEpisodes.length} episodes across ${movieData.seasons.length} seasons.`);
                    break; // Loop Break: We found a matching series, stop checking other providers
                  }
                } catch (e) {
                   console.error(`[ProviderService] [${provider}] Error fetching episodes:`, e.message);
                }
              } else {
                 console.log(`[ProviderService] [${provider}] Series matched but no episodesLink found.`);
              }
            } else {
              // Movie Flow
              // Auto-Select Logic: Prefer 720p, then 1080p, then fallback to first
              let bestItem = links.find(item => {
                const q = (item.quality || item.name || '').toLowerCase();
                return q.includes('720p');
              });

              if (!bestItem) {
                bestItem = links.find(item => {
                  const q = (item.quality || item.name || '').toLowerCase();
                  return q.includes('1080p');
                });
              }

              if (!bestItem && links.length > 0) {
                bestItem = links[0];
              }

              if (bestItem) {
                let extractedLink = "";
                if (bestItem.directLinks && bestItem.directLinks.length > 0) {
                  const dl = bestItem.directLinks[0];
                  extractedLink = typeof dl === 'string' ? dl : (dl.link || dl.url || "");
                } else {
                  extractedLink = bestItem.link || bestItem.url || bestItem;
                }
                
                movieData.defaultStreamLink = typeof extractedLink === 'string' ? extractedLink : "";
                movieData.provider_name = provider; // Save the successful provider
                console.log(`[ProviderService] [${provider}] Auto-selected quality: ${bestItem.quality || 'unknown'}. Link attached: ${movieData.defaultStreamLink}`);
                break; // Loop Break: We found a matching link, stop checking other providers
              } else {
                 console.log(`[ProviderService] [${provider}] No valid quality found in linkList.`);
              }
            }
          } else {
            console.log(`[ProviderService] [${provider}] No match found after Double Verification.`);
          }
        } else {
          console.log(`[ProviderService] [${provider}] No search results found.`);
        }
      } catch (err) {
        console.error(`[ProviderService Error] Provider ${provider} failed:`, err.message);
        // Do not crash, let the loop move to the next provider
      }
    }

  } catch (error) {
    // If something fundamentally fails, catch here
    console.error(`[ProviderService Error] Fatal error fetching provider links for ${movieData.title || 'Unknown'}:`, error.message);
  }
  
  // Always return movieData, even if link fetching failed completely
  return movieData;
}

module.exports = { fetchAndAttachProviderLinks };
