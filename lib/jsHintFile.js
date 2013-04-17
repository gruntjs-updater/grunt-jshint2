var fs = require("fs"),
    path = require("path"),
    crypto = require("crypto");

var grunt = require("grunt"),
    _ = grunt.util._,
    jshint = require('jshint').JSHINT;

var JSHintCache = require("./jsHintCache");

// Represents a file to be ran through jshint
function JSHintFile(opts) {
    _.bindAll(this, "_lintString", "_getContentsHash");

    this.filePath = opts.filePath;
    this.jsHintOpts = opts.jsHintOpts || {};
    this.globals = opts.globals || {};
    this.cache = opts.cache;

    if(this.cache) {
        this.cachedFiles = new JSHintCache();
    }
}

JSHintFile.prototype = {
    lint: function(done) {
        var self = this;

        // Grab the file contents asynch
        this._getFileContents(this.filePath, function(err, contents) {
            if(err) {
                return done(err);
            }

            var contentHash,
                lintResult;

            if(self.cache) {
                // Get a hash of the contents for later comparisons
                contentHash = self._getContentsHash(contents);

                // Check for a previously successful run of this file.
                return self.cachedFiles.hasCached(contentHash, function(isCached) {
                    if(err) {
                        return done(err);
                    }
                    
                    // If there is a previous successful run, bug out early
                    if (isCached) {
                        return done(null, true, true);
                    }

                    // Otherwise, lint the file
                    var cachedLintResult = self._lintString(contents);

                    // If lint free, add cache success
                    if(cachedLintResult.success) {
                        return self.cachedFiles.addCached(contentHash, function(err) {
                            if(err) {
                                return done(err);
                            }
                            
                            done(null, true, false);
                        });
                    }

                    // Otherwise, return the errors to be reported
                    done(null, false, cachedLintResult.errors, cachedLintResult.data);
                });
            }

            // Not caching results, so just lint and report result
            lintResult = self._lintString(contents);

            done(null, lintResult.success, lintResult.errors, lintResult.data);
        });
    },

    _lintString: function(str) {
        var result = {
            success: jshint(str, this.jsHintOpts, this.globals)
        };

        if(!result.success) {
            result.errors = jshint.errors;
            result.data = jshint.data();
        }

        return result;
    },

    // Wrapper around retrieving file contents
    _getFileContents: function(path, done) {
        // TODO: Encoding?
        fs.readFile(path, function(err, content) {
            if(err) {
                return done(err);
            }

            done(null, content.toString());
        });
    },

    // Wrapper around hashing a files contents
    _getContentsHash: function(content) {
        var sha1 = crypto.createHash('sha1');

        // The hash should include the file contents
        sha1.update(content);

        // And the jsHintOpts
        sha1.update(JSON.stringify(this.jsHintOpts));

        // And the globals
        sha1.update(JSON.stringify(this.globals));

        return sha1.digest("hex");
    }
};

module.exports = JSHintFile;