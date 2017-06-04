
// Store image urls in memory. This way if any env vars are
// missing an error will be thrown on app startup.
var defaultUrl = process.env.IMAGE_URL_0;
var imageUrls = [
  process.env.IMAGE_URL_0,
  process.env.IMAGE_URL_1,
  process.env.IMAGE_URL_2,
  process.env.IMAGE_URL_3
];

/**
 * Gets the default base URL for image
 * @returns {String} The base url
 */
exports.getBaseUrl = function() {
  return defaultUrl;
}

/**
 * Gets image for display in a list, using index to rotate base urls
 * @param {String} imageId - The image ID
 * @param {Number} index - The index of image in the list
 * @param {String} size - Size, default is 'thumb'
 * @returns {String} The image URL
 */
exports.getListImage = function(imageId, index, size) {
  var baseUrl = imageUrls[index % 4];
  return baseUrl+"/image/"+imageId+"/"+size;
}