const express = require('express');
const router = express.Router();

// Mount individual route files
router.use('/movies/trending', require('./getTrendingMovies'));
router.use('/movies/search', require('./searchMovies'));
router.use('/movies/scrape', require('./scrapeMovie'));
router.use('/movies', require('./getAllMovies'));
router.use('/movies', require('./getMovieById')); // This will match GET /movies/:imdb_id

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running successfully' });
});

module.exports = router;
