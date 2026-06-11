const express = require('express');
const router = express.Router();
const { Movie } = require('../models');

router.get('/', async (req, res, next) => {
  try {
    const { genre, year, limit = 20 } = req.query;
    
    // Build query
    let query = {};
    if (genre) {
      query.genres = { $regex: new RegExp(genre, 'i') }; 
    }
    if (year) {
      query.release_year = year;
    }

    const movies = await Movie.find(query).limit(Number(limit)).sort({ release_date: -1 });

    return res.status(200).json({
      status: 'success',
      source: 'database',
      results: movies.length,
      data: movies
    });
  } catch (error) {
    console.error('Error in getAllMovies route:', error);
    next(error);
  }
});

module.exports = router;
