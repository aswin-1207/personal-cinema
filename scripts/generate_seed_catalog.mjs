// scripts/generate_seed_catalog.mjs
// Authoritative seed catalog generator for MyCinema using real TMDB API

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_PROXY = 'https://personal-cinema-azure.vercel.app/api/tmdb?endpoint=';

// Delay helper to avoid hitting rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CURATED_LIST = [
  // ==========================================
  // A. MARVEL STUDIOS & MCU
  // ==========================================
  { query: 'Iron Man', year: 2008, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Iron Man', 'Avengers'] },
  { query: 'The Incredible Hulk', year: 2008, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Hulk', 'Avengers'] },
  { query: 'Iron Man 2', year: 2010, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Iron Man', 'Avengers'] },
  { query: 'Thor', year: 2011, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Thor', 'Avengers'] },
  { query: 'Captain America: The First Avenger', year: 2011, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Captain America', 'Avengers'] },
  { query: 'The Avengers', year: 2012, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Avengers'] },
  { query: 'Iron Man 3', year: 2013, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Iron Man', 'Avengers'] },
  { query: 'Thor: The Dark World', year: 2013, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Thor', 'Avengers'] },
  { query: 'Captain America: The Winter Soldier', year: 2014, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Captain America', 'Avengers'] },
  { query: 'Guardians of the Galaxy', year: 2014, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Guardians of the Galaxy', 'Cosmic'] },
  { query: 'Avengers: Age of Ultron', year: 2015, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Avengers'] },
  { query: 'Ant-Man', year: 2015, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Ant-Man', 'Avengers'] },
  { query: 'Captain America: Civil War', year: 2016, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Captain America', 'Avengers', 'Spider-Man'] },
  { query: 'Doctor Strange', year: 2016, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Doctor Strange', 'Avengers'] },
  { query: 'Guardians of the Galaxy Vol. 2', year: 2017, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Guardians of the Galaxy', 'Cosmic'] },
  { query: 'Spider-Man: Homecoming', year: 2017, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Spider-Man', 'Sony'] },
  { query: 'Thor: Ragnarok', year: 2017, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Thor', 'Hulk', 'Avengers'] },
  { query: 'Black Panther', year: 2018, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Black Panther', 'Avengers'] },
  { query: 'Avengers: Infinity War', year: 2018, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Avengers', 'Infinity Saga'] },
  { query: 'Ant-Man and the Wasp', year: 2018, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Ant-Man', 'Avengers'] },
  { query: 'Captain Marvel', year: 2019, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Captain Marvel', 'Avengers'] },
  { query: 'Avengers: Endgame', year: 2019, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Avengers', 'Infinity Saga'] },
  { query: 'Spider-Man: Far From Home', year: 2019, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Spider-Man', 'Sony'] },
  { query: 'Black Widow', year: 2021, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Avengers'] },
  { query: 'Shang-Chi and the Legend of the Ten Rings', year: 2021, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU'] },
  { query: 'Eternals', year: 2021, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU'] },
  { query: 'Spider-Man: No Way Home', year: 2021, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Spider-Man', 'Sony', 'Multiverse'] },
  { query: 'Doctor Strange in the Multiverse of Madness', year: 2022, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Doctor Strange', 'Multiverse'] },
  { query: 'Thor: Love and Thunder', year: 2022, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Thor'] },
  { query: 'Black Panther: Wakanda Forever', year: 2022, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Black Panther'] },
  { query: 'Ant-Man and the Wasp: Quantumania', year: 2023, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Ant-Man', 'Kang'] },
  { query: 'Guardians of the Galaxy Vol. 3', year: 2023, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Guardians of the Galaxy'] },
  { query: 'The Marvels', year: 2023, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU'] },
  { query: 'Deadpool & Wolverine', year: 2024, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Deadpool', 'Wolverine', 'X-Men'] },
  { query: 'Captain America: Brave New World', year: 2025, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU', 'Captain America'] },
  { query: 'Thunderbolts*', year: 2025, category: 'marvel', tags: ['Marvel', 'Marvel Studios', 'MCU'] },

  // ==========================================
  // B. 20TH CENTURY FOX / X-MEN & FANTASTIC FOUR
  // ==========================================
  { query: 'X-Men', year: 2000, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox', 'Mutants'] },
  { query: 'X2', year: 2003, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox', 'Mutants'] },
  { query: 'X-Men: The Last Stand', year: 2006, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox', 'Mutants'] },
  { query: 'X-Men Origins: Wolverine', year: 2009, category: 'fox_marvel', tags: ['Marvel', 'X-Men', 'Wolverine', '20th Century Fox'] },
  { query: 'X-Men: First Class', year: 2011, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox', 'Mutants'] },
  { query: 'The Wolverine', year: 2013, category: 'fox_marvel', tags: ['Marvel', 'X-Men', 'Wolverine', '20th Century Fox'] },
  { query: 'X-Men: Days of Future Past', year: 2014, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox', 'Time Travel'] },
  { query: 'Deadpool', year: 2016, category: 'fox_marvel', tags: ['Marvel', 'Deadpool', 'X-Men', '20th Century Fox'] },
  { query: 'X-Men: Apocalypse', year: 2016, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox'] },
  { query: 'Logan', year: 2017, category: 'fox_marvel', tags: ['Marvel', 'X-Men', 'Wolverine', '20th Century Fox'] },
  { query: 'Deadpool 2', year: 2018, category: 'fox_marvel', tags: ['Marvel', 'Deadpool', 'X-Men', '20th Century Fox'] },
  { query: 'Dark Phoenix', year: 2019, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox'] },
  { query: 'The New Mutants', year: 2020, category: 'fox_marvel', tags: ['Marvel', 'X-Men', '20th Century Fox'] },
  { query: 'Fantastic Four', year: 2005, category: 'fox_marvel', tags: ['Marvel', 'Fantastic Four', '20th Century Fox'] },
  { query: 'Fantastic Four: Rise of the Silver Surfer', year: 2007, category: 'fox_marvel', tags: ['Marvel', 'Fantastic Four', '20th Century Fox'] },
  { query: 'Fantastic Four', year: 2015, category: 'fox_marvel', tags: ['Marvel', 'Fantastic Four', '20th Century Fox'] },

  // ==========================================
  // C. SONY / SPIDER-MAN UNIVERSE
  // ==========================================
  { query: 'Spider-Man', year: 2002, category: 'sony_spiderman', tags: ['Marvel', 'Spider-Man', 'Sony', 'Sam Raimi'] },
  { query: 'Spider-Man 2', year: 2004, category: 'sony_spiderman', tags: ['Marvel', 'Spider-Man', 'Sony', 'Sam Raimi'] },
  { query: 'Spider-Man 3', year: 2007, category: 'sony_spiderman', tags: ['Marvel', 'Spider-Man', 'Sony', 'Sam Raimi', 'Venom'] },
  { query: 'The Amazing Spider-Man', year: 2012, category: 'sony_spiderman', tags: ['Marvel', 'Spider-Man', 'Sony', 'Andrew Garfield'] },
  { query: 'The Amazing Spider-Man 2', year: 2014, category: 'sony_spiderman', tags: ['Marvel', 'Spider-Man', 'Sony', 'Andrew Garfield'] },
  { query: 'Spider-Man: Into the Spider-Verse', year: 2018, category: 'sony_spiderman', tags: ['Marvel', 'Spider-Man', 'Spider-Verse', 'Sony', 'Animation'] },
  { query: 'Spider-Man: Across the Spider-Verse', year: 2023, category: 'sony_spiderman', tags: ['Marvel', 'Spider-Man', 'Spider-Verse', 'Sony', 'Animation'] },
  { query: 'Venom', year: 2018, category: 'sony_spiderman', tags: ['Marvel', 'Venom', 'Sony', 'SSU'] },
  { query: 'Venom: Let There Be Carnage', year: 2021, category: 'sony_spiderman', tags: ['Marvel', 'Venom', 'Sony', 'SSU'] },
  { query: 'Venom: The Last Dance', year: 2024, category: 'sony_spiderman', tags: ['Marvel', 'Venom', 'Sony', 'SSU'] },
  { query: 'Morbius', year: 2022, category: 'sony_spiderman', tags: ['Marvel', 'Sony', 'SSU'] },
  { query: 'Madame Web', year: 2024, category: 'sony_spiderman', tags: ['Marvel', 'Sony', 'SSU'] },
  { query: 'Kraven the Hunter', year: 2024, category: 'sony_spiderman', tags: ['Marvel', 'Sony', 'SSU'] },

  // ==========================================
  // D. EARLIER MARVEL (PRE-MCU)
  // ==========================================
  { query: 'Blade', year: 1998, category: 'marvel_legacy', tags: ['Marvel', 'Blade', 'Vampires', 'New Line'] },
  { query: 'Blade II', year: 2002, category: 'marvel_legacy', tags: ['Marvel', 'Blade', 'Guillermo del Toro'] },
  { query: 'Blade: Trinity', year: 2004, category: 'marvel_legacy', tags: ['Marvel', 'Blade'] },
  { query: 'Daredevil', year: 2003, category: 'marvel_legacy', tags: ['Marvel', 'Daredevil', '20th Century Fox'] },
  { query: 'Elektra', year: 2005, category: 'marvel_legacy', tags: ['Marvel', 'Elektra', '20th Century Fox'] },
  { query: 'Hulk', year: 2003, category: 'marvel_legacy', tags: ['Marvel', 'Hulk', 'Universal', 'Ang Lee'] },
  { query: 'The Punisher', year: 2004, category: 'marvel_legacy', tags: ['Marvel', 'The Punisher', 'Lionsgate'] },
  { query: 'Punisher: War Zone', year: 2008, category: 'marvel_legacy', tags: ['Marvel', 'The Punisher', 'Lionsgate'] },
  { query: 'Ghost Rider', year: 2007, category: 'marvel_legacy', tags: ['Marvel', 'Ghost Rider', 'Sony'] },
  { query: 'Ghost Rider: Spirit of Vengeance', year: 2011, category: 'marvel_legacy', tags: ['Marvel', 'Ghost Rider', 'Sony'] },

  // ==========================================
  // E. DC CATALOG (DCEU, THE DARK KNIGHT, BATMAN, SUPERMAN)
  // ==========================================
  { query: 'Superman', year: 1978, category: 'dc', tags: ['DC', 'Superman', 'Classic', 'Richard Donner'] },
  { query: 'Superman II', year: 1980, category: 'dc', tags: ['DC', 'Superman', 'Classic'] },
  { query: 'Superman Returns', year: 2006, category: 'dc', tags: ['DC', 'Superman'] },
  { query: 'Batman', year: 1989, category: 'dc', tags: ['DC', 'Batman', 'Tim Burton'] },
  { query: 'Batman Returns', year: 1992, category: 'dc', tags: ['DC', 'Batman', 'Tim Burton'] },
  { query: 'Batman Forever', year: 1995, category: 'dc', tags: ['DC', 'Batman'] },
  { query: 'Batman Begins', year: 2005, category: 'dc', tags: ['DC', 'Batman', 'The Dark Knight Trilogy', 'Christopher Nolan'] },
  { query: 'The Dark Knight', year: 2008, category: 'dc', tags: ['DC', 'Batman', 'The Dark Knight Trilogy', 'Christopher Nolan', 'Joker'] },
  { query: 'The Dark Knight Rises', year: 2012, category: 'dc', tags: ['DC', 'Batman', 'The Dark Knight Trilogy', 'Christopher Nolan'] },
  { query: 'The Batman', year: 2022, category: 'dc', tags: ['DC', 'Batman', 'Matt Reeves', 'Gotham'] },
  { query: 'Man of Steel', year: 2013, category: 'dc', tags: ['DC', 'DCEU', 'Superman', 'Zack Snyder'] },
  { query: 'Batman v Superman: Dawn of Justice', year: 2016, category: 'dc', tags: ['DC', 'DCEU', 'Batman', 'Superman', 'Wonder Woman', 'Zack Snyder'] },
  { query: 'Suicide Squad', year: 2016, category: 'dc', tags: ['DC', 'DCEU', 'Suicide Squad', 'Harley Quinn'] },
  { query: 'Wonder Woman', year: 2017, category: 'dc', tags: ['DC', 'DCEU', 'Wonder Woman', 'Gal Gadot'] },
  { query: 'Justice League', year: 2017, category: 'dc', tags: ['DC', 'DCEU', 'Justice League', 'Batman', 'Superman'] },
  { query: "Zack Snyder's Justice League", year: 2021, category: 'dc', tags: ['DC', 'DCEU', 'Justice League', 'Zack Snyder'] },
  { query: 'Aquaman', year: 2018, category: 'dc', tags: ['DC', 'DCEU', 'Aquaman'] },
  { query: 'Shazam!', year: 2019, category: 'dc', tags: ['DC', 'DCEU', 'Shazam'] },
  { query: 'Joker', year: 2019, category: 'dc', tags: ['DC', 'Joker', 'Todd Phillips', 'Joaquin Phoenix'] },
  { query: 'Birds of Prey', year: 2020, category: 'dc', tags: ['DC', 'DCEU', 'Harley Quinn'] },
  { query: 'Wonder Woman 1984', year: 2020, category: 'dc', tags: ['DC', 'DCEU', 'Wonder Woman'] },
  { query: 'The Suicide Squad', year: 2021, category: 'dc', tags: ['DC', 'DCEU', 'Suicide Squad', 'James Gunn'] },
  { query: 'Black Adam', year: 2022, category: 'dc', tags: ['DC', 'DCEU', 'Black Adam', 'Dwayne Johnson'] },
  { query: 'Shazam! Fury of the Gods', year: 2023, category: 'dc', tags: ['DC', 'DCEU', 'Shazam'] },
  { query: 'The Flash', year: 2023, category: 'dc', tags: ['DC', 'DCEU', 'The Flash', 'Batman', 'Multiverse'] },
  { query: 'Blue Beetle', year: 2023, category: 'dc', tags: ['DC', 'DCEU', 'DCU', 'Blue Beetle'] },
  { query: 'Aquaman and the Lost Kingdom', year: 2023, category: 'dc', tags: ['DC', 'DCEU', 'Aquaman'] },
  { query: 'Joker: Folie à Deux', year: 2024, category: 'dc', tags: ['DC', 'Joker', 'Harley Quinn', 'Joaquin Phoenix'] },
  { query: 'Watchmen', year: 2009, category: 'dc', tags: ['DC', 'Watchmen', 'Zack Snyder'] },
  { query: 'V for Vendetta', year: 2005, category: 'dc', tags: ['DC', 'Vertigo', 'Wachowskis'] },
  { query: 'Constantine', year: 2005, category: 'dc', tags: ['DC', 'Vertigo', 'Keanu Reeves'] },
  { query: 'Green Lantern', year: 2011, category: 'dc', tags: ['DC', 'Green Lantern', 'Ryan Reynolds'] },

  // ==========================================
  // F. DISNEY SUPERHERO & OTHER COMIC ADAPTATIONS
  // ==========================================
  { query: 'The Incredibles', year: 2004, category: 'disney_superhero', tags: ['Disney', 'Pixar', 'Superhero', 'Animation'] },
  { query: 'Incredibles 2', year: 2018, category: 'disney_superhero', tags: ['Disney', 'Pixar', 'Superhero', 'Animation'] },
  { query: 'Big Hero 6', year: 2014, category: 'disney_superhero', tags: ['Disney', 'Marvel', 'Superhero', 'Animation', 'Baymax'] },
  { query: 'Sky High', year: 2005, category: 'disney_superhero', tags: ['Disney', 'Superhero'] },
  { query: 'Hellboy', year: 2004, category: 'other_superhero', tags: ['Superhero', 'Dark Horse', 'Guillermo del Toro', 'Hellboy'] },
  { query: 'Hellboy II: The Golden Army', year: 2008, category: 'other_superhero', tags: ['Superhero', 'Dark Horse', 'Guillermo del Toro', 'Hellboy'] },
  { query: 'Hellboy: The Crooked Man', year: 2024, category: 'other_superhero', tags: ['Superhero', 'Dark Horse', 'Hellboy'] },
  { query: 'Kick-Ass', year: 2010, category: 'other_superhero', tags: ['Superhero', 'Comic Book', 'Matthew Vaughn'] },
  { query: 'Kick-Ass 2', year: 2013, category: 'other_superhero', tags: ['Superhero', 'Comic Book'] },
  { query: 'Teenage Mutant Ninja Turtles', year: 1990, category: 'other_superhero', tags: ['Superhero', 'TMNT', 'Comic Book'] },
  { query: 'TMNT', year: 2007, category: 'other_superhero', tags: ['Superhero', 'TMNT', 'Animation'] },
  { query: 'Teenage Mutant Ninja Turtles', year: 2014, category: 'other_superhero', tags: ['Superhero', 'TMNT'] },
  { query: 'Teenage Mutant Ninja Turtles: Mutant Mayhem', year: 2023, category: 'other_superhero', tags: ['Superhero', 'TMNT', 'Animation'] },
  { query: 'The Crow', year: 1994, category: 'other_superhero', tags: ['Superhero', 'Dark Hero', 'Brandon Lee'] },
  { query: 'The Crow', year: 2024, category: 'other_superhero', tags: ['Superhero', 'Dark Hero', 'Bill Skarsgard'] },
  { query: 'Spawn', year: 1997, category: 'other_superhero', tags: ['Superhero', 'Image Comics', 'Spawn'] },
  { query: 'Chronicle', year: 2012, category: 'other_superhero', tags: ['Superhero', 'Sci-Fi', 'Found Footage'] },
  { query: 'Unbreakable', year: 2000, category: 'other_superhero', tags: ['Superhero', 'M. Night Shyamalan', 'Bruce Willis'] },
  { query: 'Split', year: 2016, category: 'other_superhero', tags: ['Superhero', 'M. Night Shyamalan', 'James McAvoy'] },
  { query: 'Glass', year: 2019, category: 'other_superhero', tags: ['Superhero', 'M. Night Shyamalan', 'Eastrail 177'] },
  { query: 'Hancock', year: 2008, category: 'other_superhero', tags: ['Superhero', 'Will Smith'] },
  { query: 'The Mask', year: 1994, category: 'other_superhero', tags: ['Superhero', 'Dark Horse', 'Jim Carrey'] },
  { query: 'Scott Pilgrim vs. the World', year: 2010, category: 'other_superhero', tags: ['Comic Book', 'Edgar Wright', 'Cult Classic'] },
  { query: 'Dredd', year: 2012, category: 'other_superhero', tags: ['Comic Book', 'Judge Dredd', 'Karl Urban', 'Action'] },
  { query: 'Megamind', year: 2010, category: 'other_superhero', tags: ['Superhero', 'DreamWorks', 'Animation'] },
  { query: 'RoboCop', year: 1987, category: 'other_superhero', tags: ['Sci-Fi', 'Cyberpunk', 'Paul Verhoeven'] },

  // ==========================================
  // G. RECENT BLOCKBUSTERS & CONTEMPORARY CLASSICS
  // ==========================================
  { query: 'Oppenheimer', year: 2023, category: 'recent_popular', tags: ['Christopher Nolan', 'Biography', 'Drama', 'Oscar Winner'] },
  { query: 'Barbie', year: 2023, category: 'recent_popular', tags: ['Greta Gerwig', 'Comedy', 'Fantasy', 'Blockbuster'] },
  { query: 'Dune', year: 2021, category: 'recent_popular', tags: ['Denis Villeneuve', 'Sci-Fi', 'Epic', 'Space'] },
  { query: 'Dune: Part Two', year: 2024, category: 'recent_popular', tags: ['Denis Villeneuve', 'Sci-Fi', 'Epic', 'Space'] },
  { query: 'Interstellar', year: 2014, category: 'recent_popular', tags: ['Christopher Nolan', 'Sci-Fi', 'Space', 'Masterpiece'] },
  { query: 'Inception', year: 2010, category: 'recent_popular', tags: ['Christopher Nolan', 'Sci-Fi', 'Mind-Bending', 'Thriller'] },
  { query: 'Avatar', year: 2009, category: 'recent_popular', tags: ['James Cameron', 'Sci-Fi', 'Pandora', 'Blockbuster'] },
  { query: 'Avatar: The Way of Water', year: 2022, category: 'recent_popular', tags: ['James Cameron', 'Sci-Fi', 'Pandora', 'Blockbuster'] },
  { query: 'Top Gun: Maverick', year: 2022, category: 'recent_popular', tags: ['Tom Cruise', 'Action', 'Aviation', 'Blockbuster'] },
  { query: 'Everything Everywhere All at Once', year: 2022, category: 'recent_popular', tags: ['A24', 'Sci-Fi', 'Multiverse', 'Oscar Winner'] },
  { query: 'Furiosa: A Mad Max Saga', year: 2024, category: 'recent_popular', tags: ['George Miller', 'Mad Max', 'Action', 'Wasteland'] },
  { query: 'Alien: Romulus', year: 2024, category: 'recent_popular', tags: ['Alien', 'Sci-Fi', 'Horror', 'Xenomorph'] },
  { query: 'Gladiator II', year: 2024, category: 'recent_popular', tags: ['Ridley Scott', 'Gladiator', 'Historical Epic', 'Action'] },
  { query: 'Twisters', year: 2024, category: 'recent_popular', tags: ['Disaster', 'Action', 'Blockbuster'] },
  { query: 'Kingdom of the Planet of the Apes', year: 2024, category: 'recent_popular', tags: ['Planet of the Apes', 'Sci-Fi', 'Apes'] },
  { query: 'Godzilla Minus One', year: 2023, category: 'recent_popular', tags: ['Godzilla', 'Kaiju', 'Japan', 'Oscar Winner'] },
  { query: 'Civil War', year: 2024, category: 'recent_popular', tags: ['Alex Garland', 'A24', 'Dystopian', 'Thriller'] },
  { query: 'Poor Things', year: 2023, category: 'recent_popular', tags: ['Yorgos Lanthimos', 'Emma Stone', 'Fantasy', 'Oscar Winner'] },
  { query: 'The Substance', year: 2024, category: 'recent_popular', tags: ['Demi Moore', 'Body Horror', 'Thriller'] },
  { query: 'Longlegs', year: 2024, category: 'recent_popular', tags: ['Nicolas Cage', 'Horror', 'Thriller', 'Neon'] },
  { query: 'Beetlejuice Beetlejuice', year: 2024, category: 'recent_popular', tags: ['Tim Burton', 'Michael Keaton', 'Comedy', 'Horror'] },
  { query: 'Inside Out 2', year: 2024, category: 'recent_popular', tags: ['Pixar', 'Disney', 'Animation', 'Blockbuster'] },
  { query: 'Wicked', year: 2024, category: 'recent_popular', tags: ['Musical', 'Fantasy', 'Oz'] },
  { query: 'Moana 2', year: 2024, category: 'recent_popular', tags: ['Disney', 'Animation', 'Adventure'] },
  { query: 'Sonic the Hedgehog 3', year: 2024, category: 'recent_popular', tags: ['Video Game', 'Sonic', 'Shadow', 'Family'] },
  { query: 'Smile 2', year: 2024, category: 'recent_popular', tags: ['Horror', 'Thriller'] },
  { query: 'Terrifier 3', year: 2024, category: 'recent_popular', tags: ['Horror', 'Slasher', 'Art the Clown'] },
  { query: 'Nosferatu', year: 2024, category: 'recent_popular', tags: ['Robert Eggers', 'Vampire', 'Gothic Horror'] },

  // ==========================================
  // H. INDIAN & REGIONAL POWERHOUSES
  // ==========================================
  // Tamil
  { query: 'Leo', year: 2023, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Thalapathy Vijay', 'LCU', 'Lokesh Kanagaraj', 'Action'] },
  { query: 'Vikram', year: 2022, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Kamal Haasan', 'LCU', 'Lokesh Kanagaraj', 'Action'] },
  { query: 'Kaithi', year: 2019, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Karthi', 'LCU', 'Lokesh Kanagaraj', 'Thriller'] },
  { query: 'Jailer', year: 2023, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Rajinikanth', 'Nelson', 'Action'] },
  { query: 'The Greatest of All Time', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Thalapathy Vijay', 'Venkat Prabhu', 'Sci-Fi'] },
  { query: 'Master', year: 2021, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Thalapathy Vijay', 'Vijay Sethupathi'] },
  { query: 'Ponniyin Selvan: Part I', year: 2022, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Mani Ratnam', 'Historical Epic', 'Chola'] },
  { query: 'Ponniyin Selvan: Part II', year: 2023, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Mani Ratnam', 'Historical Epic', 'Chola'] },
  { query: 'Maharaja', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Vijay Sethupathi', 'Thriller', 'Revenge'] },
  { query: 'Amaran', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Sivakarthikeyan', 'Major Mukund', 'Military'] },
  { query: 'Raayan', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Dhanush', 'Gangster', 'Action'] },
  { query: 'Vettaiyan', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Rajinikanth', 'Amitabh Bachchan'] },
  { query: 'Enthiran', year: 2010, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Rajinikanth', 'Shankar', 'Sci-Fi', 'Robot'] },
  { query: '2.0', year: 2018, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Rajinikanth', 'Akshay Kumar', 'Sci-Fi'] },
  { query: 'Sivaji: The Boss', year: 2007, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Rajinikanth', 'Shankar'] },
  { query: 'Thani Oruvan', year: 2015, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Jayam Ravi', 'Arvind Swamy', 'Thriller'] },
  { query: 'Mankatha', year: 2011, category: 'indian_cinema', tags: ['Indian', 'Tamil', 'Ajith Kumar', 'Venkat Prabhu', 'Heist'] },

  // Telugu
  { query: 'RRR', year: 2022, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'SS Rajamouli', 'Ram Charan', 'Jr NTR', 'Oscar Winner'] },
  { query: 'Baahubali: The Beginning', year: 2015, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'SS Rajamouli', 'Prabhas', 'Epic'] },
  { query: 'Baahubali 2: The Conclusion', year: 2017, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'SS Rajamouli', 'Prabhas', 'Epic'] },
  { query: 'Kalki 2898-AD', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'Prabhas', 'Amitabh Bachchan', 'Sci-Fi', 'Mythology'] },
  { query: 'Pushpa: The Rise', year: 2021, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'Allu Arjun', 'Action'] },
  { query: 'Pushpa 2: The Rule', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'Allu Arjun', 'Action'] },
  { query: 'Salaar: Part 1 - Ceasefire', year: 2023, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'Prabhas', 'Prashanth Neel', 'Action'] },
  { query: 'Devara: Part 1', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'Jr NTR', 'Action'] },
  { query: 'Hanu-Man', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'Superhero', 'Prasanth Varma', 'Mythology'] },
  { query: 'Eega', year: 2012, category: 'indian_cinema', tags: ['Indian', 'Telugu', 'SS Rajamouli', 'Fantasy', 'Revenge'] },

  // Malayalam
  { query: 'Manjummel Boys', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Survival', 'Friendship', 'Guna Caves'] },
  { query: 'Aavesham', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Fahadh Faasil', 'Action', 'Comedy', 'Ranga'] },
  { query: 'Bramayugam', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Mammootty', 'Horror', 'Period'] },
  { query: 'Premalu', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Rom-Com', 'Youth'] },
  { query: 'Aadujeevitham', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Prithviraj Sukumaran', 'Survival', 'Blessy'] },
  { query: 'Minnal Murali', year: 2021, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Tovino Thomas', 'Basil Joseph', 'Superhero'] },
  { query: 'Lucifer', year: 2019, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Mohanlal', 'Prithviraj Sukumaran', 'Action'] },
  { query: 'Drishyam', year: 2013, category: 'indian_cinema', tags: ['Indian', 'Malayalam', 'Mohanlal', 'Jeethu Joseph', 'Thriller'] },

  // Hindi & Kannada
  { query: 'Jawan', year: 2023, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Shah Rukh Khan', 'Atlee', 'Action'] },
  { query: 'Pathaan', year: 2023, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Shah Rukh Khan', 'YRF Spy Universe', 'Action'] },
  { query: 'Stree', year: 2018, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Horror Comedy', 'Rajkummar Rao'] },
  { query: 'Stree 2', year: 2024, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Horror Comedy', 'Shraddha Kapoor', 'Blockbuster'] },
  { query: 'Animal', year: 2023, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Ranbir Kapoor', 'Sandeep Reddy Vanga', 'Action'] },
  { query: 'Brahmastra Part One: Shiva', year: 2022, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Superhero', 'Astraverse', 'Fantasy'] },
  { query: 'Krrish', year: 2006, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Hrithik Roshan', 'Superhero'] },
  { query: 'Krrish 3', year: 2013, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Hrithik Roshan', 'Superhero'] },
  { query: 'Ra.One', year: 2011, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Shah Rukh Khan', 'Superhero', 'Sci-Fi'] },
  { query: 'Tumbbad', year: 2018, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Mythological Horror', 'Folk', 'Masterpiece'] },
  { query: '3 Idiots', year: 2009, category: 'indian_cinema', tags: ['Indian', 'Hindi', 'Aamir Khan', 'Rajkumar Hirani', 'Classic'] },
  { query: 'K.G.F: Chapter 1', year: 2018, category: 'indian_cinema', tags: ['Indian', 'Kannada', 'Yash', 'Prashanth Neel', 'Action'] },
  { query: 'K.G.F: Chapter 2', year: 2022, category: 'indian_cinema', tags: ['Indian', 'Kannada', 'Yash', 'Prashanth Neel', 'Blockbuster'] },
  { query: 'Kantara', year: 2022, category: 'indian_cinema', tags: ['Indian', 'Kannada', 'Rishab Shetty', 'Divine Folk', 'Thriller'] },
];

async function fetchFromTMDB(endpoint) {
  const url = TMDB_PROXY + endpoint;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * attempt);
    }
  }
}

async function searchMovie(query, year) {
  let endpoint = `/search/movie&query=${encodeURIComponent(query)}`;
  if (year) endpoint += `&year=${year}`;
  const data = await fetchFromTMDB(endpoint);
  if (data && data.results && data.results.length > 0) {
    return data.results[0];
  }
  // Try without year if not found
  if (year) {
    const fallbackData = await fetchFromTMDB(`/search/movie&query=${encodeURIComponent(query)}`);
    if (fallbackData && fallbackData.results && fallbackData.results.length > 0) {
      return fallbackData.results[0];
    }
  }
  return null;
}

async function getMovieDetails(tmdbId) {
  return await fetchFromTMDB(`/movie/${tmdbId}`);
}

async function main() {
  console.log('====================================================');
  console.log('BUILDING CURATED SEED CATALOG FOR MYCINEMA');
  console.log('====================================================\n');

  const movieMap = new Map();
  const categoryStats = {
    marvel: 0,
    fox_marvel: 0,
    sony_spiderman: 0,
    marvel_legacy: 0,
    dc: 0,
    disney_superhero: 0,
    other_superhero: 0,
    recent_popular: 0,
    indian_cinema: 0,
    trending: 0,
  };

  console.log(`Processing ${CURATED_LIST.length} curated title specifications...`);

  let resolvedCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < CURATED_LIST.length; i++) {
    const item = CURATED_LIST[i];
    try {
      const match = await searchMovie(item.query, item.year);
      if (match && match.id) {
        if (!movieMap.has(match.id)) {
          // Normalize to Movie schema
          const movieRecord = {
            id: match.id,
            title: match.title,
            originalTitle: match.original_title || match.title,
            overview: match.overview || '',
            releaseDate: match.release_date || '',
            runtime: match.runtime || null,
            posterPath: match.poster_path || null,
            backdropPath: match.backdrop_path || null,
            voteAverage: typeof match.vote_average === 'number' ? Number(match.vote_average.toFixed(1)) : 0,
            voteCount: match.vote_count || 0,
            genres: Array.isArray(match.genres)
              ? match.genres
              : (match.genre_ids || []).map((gid) => ({ id: gid, name: '' })),
            status: 'Released',
            lastFetched: new Date().toISOString(),
            source: 'seed',
            seedCategory: item.category,
            franchiseTags: item.tags,
          };

          movieMap.set(match.id, movieRecord);
          categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
          resolvedCount++;
        } else {
          // Merge franchise tags if duplicate ID found across categories
          const existing = movieMap.get(match.id);
          const combinedTags = Array.from(new Set([...(existing.franchiseTags || []), ...item.tags]));
          existing.franchiseTags = combinedTags;
        }
      } else {
        console.warn(`[NOT FOUND] "${item.query}" (${item.year})`);
        notFoundCount++;
      }

      if ((i + 1) % 25 === 0 || i === CURATED_LIST.length - 1) {
        console.log(`Progress: ${i + 1}/${CURATED_LIST.length} items processed (${movieMap.size} unique movies)`);
      }

      await sleep(120); // polite rate limit
    } catch (err) {
      console.error(`Error resolving "${item.query}":`, err.message);
    }
  }

  // Fetch Current Live Trending from TMDB to fulfill Requirement 9
  console.log('\nFetching current live TMDB trending movies (Requirement 9)...');
  try {
    const trendingData = await fetchFromTMDB('/trending/movie/week');
    if (trendingData && Array.isArray(trendingData.results)) {
      for (const tm of trendingData.results) {
        if (!movieMap.has(tm.id)) {
          const trendingRecord = {
            id: tm.id,
            title: tm.title,
            originalTitle: tm.original_title || tm.title,
            overview: tm.overview || '',
            releaseDate: tm.release_date || '',
            runtime: tm.runtime || null,
            posterPath: tm.poster_path || null,
            backdropPath: tm.backdrop_path || null,
            voteAverage: typeof tm.vote_average === 'number' ? Number(tm.vote_average.toFixed(1)) : 0,
            voteCount: tm.vote_count || 0,
            genres: (tm.genre_ids || []).map((gid) => ({ id: gid, name: '' })),
            status: 'Released',
            lastFetched: new Date().toISOString(),
            source: 'seed',
            seedCategory: 'trending',
            franchiseTags: ['Trending', 'Popular', '2026'],
          };
          movieMap.set(tm.id, trendingRecord);
          categoryStats.trending = (categoryStats.trending || 0) + 1;
        }
      }
      console.log(`Added ${categoryStats.trending} live trending movies!`);
    }
  } catch (err) {
    console.warn('Could not fetch trending feed:', err.message);
  }

  const allSeedMovies = Array.from(movieMap.values());

  // Save as JSON
  const outputJsonPath = path.resolve(__dirname, '../src/data/seedCatalog.json');
  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, JSON.stringify(allSeedMovies, null, 2), 'utf-8');

  // Also save as TypeScript export file
  const outputTsPath = path.resolve(__dirname, '../src/data/seedCatalog.ts');
  const tsContent = `// Auto-generated by scripts/generate_seed_catalog.mjs
// Authoritative curated seed catalog for MyCinema using real TMDB IDs
import { Movie } from '../types/movie';

export const SEED_CATALOG_VERSION = 1;

export const SEED_MOVIES: Movie[] = ${JSON.stringify(allSeedMovies, null, 2)};
`;
  fs.writeFileSync(outputTsPath, tsContent, 'utf-8');

  console.log('\n====================================================');
  console.log('SEED CATALOG GENERATION SUMMARY');
  console.log('====================================================');
  console.log(`Total Unique Seeded Movies: ${allSeedMovies.length}`);
  console.log('Breakdown by Category:');
  console.log(`- Marvel Studios / MCU:       ${categoryStats.marvel}`);
  console.log(`- 20th Century Fox / X-Men:   ${categoryStats.fox_marvel}`);
  console.log(`- Sony / Spider-Man:          ${categoryStats.sony_spiderman}`);
  console.log(`- Earlier Marvel Legacy:      ${categoryStats.marvel_legacy}`);
  console.log(`- DC Catalog:                 ${categoryStats.dc}`);
  console.log(`- Disney Superhero:           ${categoryStats.disney_superhero}`);
  console.log(`- Other Superhero:            ${categoryStats.other_superhero}`);
  console.log(`- Recent Popular Blockbuster: ${categoryStats.recent_popular}`);
  console.log(`- Indian Popular Cinema:      ${categoryStats.indian_cinema}`);
  console.log(`- Live TMDB Trending (2026):  ${categoryStats.trending}`);
  console.log(`\nFiles Written:`);
  console.log(`- ${outputJsonPath}`);
  console.log(`- ${outputTsPath}`);
  console.log('====================================================\n');
}

main().catch(console.error);
