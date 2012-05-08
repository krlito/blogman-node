/*!
* dirutils-node
* Copyright(c) 2012 Carlos Campo <carlos@campo.com.co>
* MIT Licensed
*/

//Dependencies
var fs = require('fs'),
  path = require('path'),
  exec = require('child_process').exec;

// PUBLIC EXPORTS //
var dirutils = exports;

/*
 * Build a directory if it does not exist
 */
dirutils.buildDir = function (dir, callback) {
  dir = dir + "/";
  path.exists(dir, function (exists) {
    if (!exists) {
      exec("mkdir -p " + dir, function (err, stdout, stderr) {
        process.nextTick(function () {
          if (callback) { callback(err); }
        });
      });
    } else {
      process.nextTick(function () {
        if (callback) { callback(null); }
      });
    }
  });
};


/*
 * List files in a directory
 */
dirutils.ls = function (dir, pattern, sorted, callback) {
  fs.readdir(dir, function (err, files) {
    if (err) { process.nextTick(function () { callback(err); }); return; }

    if (pattern) {
      files = files.filter(function (e) { return pattern.test(e); });
    }

    if (sorted) {
      files.sort();
    }

    process.nextTick(function () { callback(null, files); });
  });
};
