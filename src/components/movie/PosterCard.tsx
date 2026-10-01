import React from 'react';
import { MoviePoster, MoviePosterProps } from './MoviePoster';

export interface PosterCardProps extends MoviePosterProps {}

export const PosterCard: React.FC<PosterCardProps> = (props) => {
  return <MoviePoster {...props} />;
};

export default PosterCard;
