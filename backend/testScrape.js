const axios = require('axios');

async function testScrape(imdb_id) {
  try {
    const url = `https://www.imdb.com/title/${imdb_id}/`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    const html = response.data;
    // Regex to match <meta property="og:image" content="...">
    const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    
    if (match && match[1]) {
      console.log(`Poster for ${imdb_id}: ${match[1]}`);
    } else {
      console.log(`Poster for ${imdb_id} NOT FOUND`);
    }
  } catch (err) {
    console.error(`Error for ${imdb_id}: ${err.message}`);
  }
}

testScrape('tt0108052'); // Schindler's list
testScrape('tt0468569'); // The Dark Knight
testScrape('tt0110912'); // Pulp Fiction
