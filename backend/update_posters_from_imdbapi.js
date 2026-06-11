const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();
const { Movie } = require('./src/models');

async function updatePosters() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const movies = await Movie.find();
    console.log(`Found ${movies.length} movies to update...`);

    let count = 0;
    for (const movie of movies) {
      if (!movie.imdb_id) continue;

      try {
        // Calling your own Python IMDB API scraper
        const response = await axios.get(`http://localhost:8000/movie/${movie.imdb_id}`);
        const data = response.data;

        if (data && data.poster_url) {
          await Movie.updateOne(
            { _id: movie._id },
            { poster_url: data.poster_url }
          );
          console.log(`✅ Updated poster for: ${movie.title}`);
          count++;
        } else {
          console.log(`❌ No poster returned by IMDB API for: ${movie.title} (${movie.imdb_id})`);
        }
      } catch (err) {
        console.error(`⚠️ Error fetching IMDB API for ${movie.title}: ${err.message}`);
      }

      // Small delay to be polite to the local Python API / IMDb GraphQL
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Done! Successfully updated ${count} posters using your IMDB scraper.`);
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

updatePosters();
