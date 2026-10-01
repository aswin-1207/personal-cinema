import React from 'react';
import { MoviePoster, MoviePosterProps } from './MoviePoster';

export interface MovieCardProps extends MoviePosterProps {}

export const MovieCard: React.FC<MovieCardProps> = (props) => {
  return <MoviePoster {...props} />;
};

export default MovieCard;
