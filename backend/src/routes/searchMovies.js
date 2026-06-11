const express = require('express');
const router = express.Router();
const { Movie } = require('../models');
const scraperService = require('../services/scraperService');

router.get('/', async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ status: 'error', message: 'Query parameter is required' });
    }

    // 1. Check MongoDB first
    const dbMovies = await Movie.find({
      title: { $regex: new RegExp(query, 'i') }
    }).limit(20);

    if (dbMovies.length > 0) {
      return res.status(200).json({
        status: 'success',
        source: 'database',
        results: dbMovies.length,
        data: dbMovies
      });
    }

    // 2. If not found in DB, fallback to Scraper
    console.log(`No results for '${query}' in DB. Searching scraper...`);
    const scraperResults = await scraperService.searchMovies(query);
    
    // Check if scraper returned valid array
    if (!scraperResults || !Array.isArray(scraperResults) || scraperResults.length === 0) {
      return res.status(200).json({
        status: 'success',
        source: 'scraper',
        results: 0,
        message: 'No movies found for this query even after scraping',
        data: []
      });
    }

    // 3. Save all results from scraper to DB (Upsert)
    const savedMovies = [];
    for (const item of scraperResults) {
      // Scraper might return partial data on search, but we save what we can.
      // We map it to our schema structure.
      const movieData = {
        imdb_id: item.imdb_id || item.id, // Depending on the exact scraper API response keys
        title: item.title || "",
        original_title: item.original_title || "",
        title_type: item.title_type || "",
        release_year: item.release_year || null,
        release_date: item.release_date || "",
        runtime_minutes: item.runtime_minutes || null,
        rating: item.rating || null,
        vote_count: item.vote_count || null,
        metascore: item.metascore || null,
        genres: item.genres || [],
        plot: item.plot || "",
        poster_url: item.poster_url || "",
        streaming_url: "",
      };

      // Only insert if imdb_id exists
      if (movieData.imdb_id) {
        const savedDoc = await Movie.findOneAndUpdate(
          { imdb_id: movieData.imdb_id },
          movieData,
          { new: true, upsert: true }
        );
        savedMovies.push(savedDoc);
      }
    }

    // 4. Return the saved movies to the frontend
    return res.status(200).json({
      status: 'success',
      source: 'scraper',
      results: savedMovies.length,
      data: savedMovies
    });

  } catch (error) {
    console.error('Error in searchMovies route:', error);
    next(error);
  }
});

module.exports = router;
