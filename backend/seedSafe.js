const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();
const { Movie } = require('./src/models');

const genres = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", 
  "Documentary", "Drama", "Family", "Fantasy", "History"
];

// Using 30 movies per genre to avoid triggering IMDb rate limits (500 errors)
const LIMIT_PER_GENRE = 30; 
// MUST use local API because Render API has the old poster bug
const LOCAL_PYTHON_API = 'http://localhost:8000';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runSeeder() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('🗑️ Clearing old database to remove wrong posters...');
    await Movie.deleteMany({});
    console.log('✅ Database cleared!');

    console.log('🚀 Starting Safe Movie Seeder... (Slower to avoid IMDb 500 errors)');
    let totalSaved = 0;

    for (const genre of genres) {
      console.log(`\n========================================`);
      console.log(`🎬 Fetching top ${LIMIT_PER_GENRE} movies for genre: ${genre}`);
      console.log(`========================================`);

      try {
        const searchUrl = `${LOCAL_PYTHON_API}/search/genre/${encodeURIComponent(genre)}?limit=${LIMIT_PER_GENRE}`;
        const searchResponse = await axios.get(searchUrl);
        const moviesArray = searchResponse.data[0] || [];

        if (!Array.isArray(moviesArray) || moviesArray.length === 0) {
          console.log(`⚠️ No movies found for genre ${genre}`);
          continue;
        }

        console.log(`✅ Found ${moviesArray.length} movies. Fetching details slowly...`);

        for (let i = 0; i < moviesArray.length; i++) {
          const imdbId = moviesArray[i]?.node?.title?.id;
          if (!imdbId) continue;

          try {
            const detailResponse = await axios.get(`${LOCAL_PYTHON_API}/movie/${imdbId}`);
            const scraperData = detailResponse.data;

            if (scraperData && scraperData.id) {
              const movieData = {
                imdb_id: scraperData.id,
                title: scraperData.title || "",
                original_title: scraperData.original_title || "",
                title_type: scraperData.title_type || "",
                release_year: scraperData.release_year || null,
                release_date: scraperData.release_date || "",
                runtime_minutes: scraperData.runtime_minutes || null,
                rating: scraperData.rating || null,
                vote_count: scraperData.vote_count || null,
                metascore: scraperData.metascore || null,
                genres: scraperData.genres || [],
                plot: scraperData.plot || "",
                poster_url: scraperData.poster_url || "",
                streaming_url: "",
              };

              await Movie.create(movieData);
              console.log(`[${i + 1}/${moviesArray.length}] Saved: ${scraperData.title} (${imdbId})`);
              totalSaved++;
            }
          } catch (err) {
            // Silently ignore duplicate key errors, they are perfectly normal!
            if (err.code === 11000 || (err.message && err.message.includes('11000'))) {
               // Duplicate skipped silently
            } else if (err.response && err.response.status === 500) {
               console.log(`⚠️ IMDb Rate Limited on ${imdbId}. Skipping to next...`);
            } else {
               console.log(`⚠️ Error on ${imdbId}: ${err.message}`);
            }
          }

          // Delay 1.5 seconds between each movie to prevent IMDb 500 errors!
          await sleep(1500); 
        }
      } catch (err) {
        console.error(`❌ Failed to fetch genre ${genre}: ${err.message}`);
      }

      // Delay 3 seconds between genres
      await sleep(3000);
    }

    console.log(`\n🎉 SEEDING COMPLETE! Successfully saved ${totalSaved} unique movies.`);
  } catch (err) {
    console.error('Fatal Error:', err);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

runSeeder();
