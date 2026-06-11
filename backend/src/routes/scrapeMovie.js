const express = require('express');
const router = express.Router();
const { Movie } = require('../models');
const scraperService = require('../services/scraperService');

router.post('/', async (req, res, next) => {
  try {
    const { imdb_id } = req.body;

    if (!imdb_id) {
      return res.status(400).json({ status: 'error', message: 'imdb_id is required' });
    }

    // 1. Check Cache
    const existingMovie = await Movie.findOne({ imdb_id: imdb_id });
    if (existingMovie) {
      return res.status(200).json({ status: 'success', source: 'database', data: existingMovie });
    }

    // 2. Fetch from Scraper
    const scraperData = await scraperService.fetchMovieDetails(imdb_id);
    if (!scraperData || !scraperData.id) {
      return res.status(404).json({ status: 'error', message: 'Movie not found by scraper' });
    }

    // 3. Map Data
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

    // 4. Save
    const savedMovie = await Movie.create(movieData);

    return res.status(201).json({ status: 'success', source: 'scraper', data: savedMovie });

  } catch (error) {
    console.error('Error in scrapeMovie route:', error);
    next(error);
  }
});

module.exports = router;
