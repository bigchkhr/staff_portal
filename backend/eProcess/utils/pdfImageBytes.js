function toEmbeddableImageBytes(input) {
  if (input == null) return input;
  const view = Buffer.isBuffer(input) || input instanceof Uint8Array ? input : new Uint8Array(input);
  return Uint8Array.from(view);
}

module.exports = { toEmbeddableImageBytes };
