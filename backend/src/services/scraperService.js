const axios = require('axios');

// Default URL if not provided in .env
const SCRAPER_BASE_URL = process.env.SCRAPER_URL || 'https://imdbapi-gv4r.onrender.com';

const fetchMovieFromScraper = async (title) => {
  try {
    // Example: Calling the external python/node scraper API
    const response = await axios.get(`${SCRAPER_BASE_URL}/scrape`, {
      params: { movie: title }
    });
    
    // The scraper should return the data in a JSON format matching our needs
    return response.data;
  } catch (error) {
    console.error(`Error fetching movie from scraper: ${error.message}`);
    throw new Error('Failed to fetch data from scraper');
  }
};

const fetchMovieDetails = async (imdbId) => {
  try {
    const response = await axios.get(`${SCRAPER_BASE_URL}/movie/${imdbId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching movie details from scraper: ${error.message}`);
    throw new Error('Failed to fetch movie details from scraper');
  }
};

const searchMovies = async (query, limit = 10) => {
  try {
    const response = await axios.get(`${SCRAPER_BASE_URL}/search/${encodeURIComponent(query)}`, {
      params: { limit }
    });
    return response.data; // Should return an array of movies based on the API docs
  } catch (error) {
    console.error(`Error searching movies from scraper: ${error.message}`);
    throw new Error('Failed to search movies from scraper');
  }
};

module.exports = {
  fetchMovieFromScraper,
  fetchMovieDetails,
  searchMovies,
};
