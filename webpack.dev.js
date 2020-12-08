const merge = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge.default(common, {
  mode: "development",
  devtool: "inline-source-map",
});
