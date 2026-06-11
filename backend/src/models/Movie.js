const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  imdb_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
  },
  original_title: {
    type: String,
  },
  title_type: {
    type: String,
  },
  release_year: {
    type: Number,
  },
  release_date: {
    type: String,
  },
  runtime_minutes: {
    type: Number,
  },
  rating: {
    type: Number,
  },
  vote_count: {
    type: Number,
  },
  metascore: {
    type: Number,
  },
  genres: [{
    type: String,
  }],
  plot: {
    type: String,
  },
  poster_url: {
    type: String,
  },
  streaming_url: {
    type: String,
    default: "", // As requested, empty for now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Movie', movieSchema);
