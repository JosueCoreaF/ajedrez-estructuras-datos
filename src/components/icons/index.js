// Mapeo estático de piezas a imágenes en la carpeta `src/components/icons`
// Ajusta rutas si mueves las imágenes.
// Mapping by color+type: e.g. 'wp' = white pawn, 'bp' = black pawn
const PIECE_IMAGES = {
  // Peones
  wp: require('./peon-de-ajedrez (1).png'),
  bp: require('./peon-de-ajedrez.png'),

  // Torres
  wr: require('./ajedrez-rok (1).png'),
  br: require('./ajedrez-rok.png'),

  // Caballos
  wn: require('./caballero-de-ajedrez (1).png'),
  bn: require('./caballero-de-ajedrez.png'),

  // Alfiles
  wb: require('./obispo (1).png'),
  bb: require('./obispo.png'),

  // Reinas
  wq: require('./reina-del-ajedrez (1).png'),
  bq: require('./reina-del-ajedrez.png'),

  // Reyes
  wk: require('./rey-del-ajedrez (1).png'),
  bk: require('./rey-del-ajedrez.png'),
};

export default PIECE_IMAGES;
