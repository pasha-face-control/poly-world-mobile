module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // three.js (used by the 3D mini-games) ships modern "static { }" class blocks.
    // Hermes does not support them, so enable the transform for the production export.
    plugins: ["@babel/plugin-transform-class-static-block"],
  };
};
