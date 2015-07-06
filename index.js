'use strict';

function documentLock(schema, options) {
    options = options || {}
    var LOCK_TIME_FIRE = options.lockTimeFire || 1000;
    var lockColumnName = "lockExpirationDate";

    //TODO: use curstom lock columns
    var data = {};
    data[lockColumnName] = Date;
    schema.add(data);

    schema.methods.takeLock = function takeLock(callback) {
        var self = this;
        var expirationDate = new Date();
        expirationDate.setSeconds(expirationDate.getSeconds() + LOCK_TIME_FIRE);

        var query = {_id: self._id};
        query[lockColumnName] = self[lockColumnName];

        var update = {};
        update[lockColumnName] = expirationDate;

        self.model(self.constructor.modelName).update(query, update, function(err, numAffected) {
            if (!callback) {
                return
            }
            if (numAffected != 1) {
                return callback(new Error("Unable to take lock. Someone take it before us"));
            }
            callback();
        });
    };

    schema.methods.getLock = function getLock(callback) {
        var self = this;
        self.isLocked(function(err, locked) {
            if (err) {
                return callback(err);
            }

            if (locked) {
                return callback(new Error("Can't get lock, document is allready locked"));
            }

            self.takeLock(function(err) {
                if (err) {
                    return callback(err)
                }
                self.lockTimer = setInterval(function() {
                    self.takeLock()
                }, LOCK_TIME_FIRE / 2);
                callback();
            })
        });

    };

    schema.methods.isLocked = function isLocked(callback) {
        var self = this;
        self.model(self.constructor.modelName).findOne({_id: self._id}, function(err, doc) {
            if (err) {
                return callback(err);
            }

            if (doc[lockColumnName] == null) {
                return callback(null, false);
            }

            if (doc[lockColumnName] < new Date()) {
                return callback(null, false);
            }
            return callback(null, true);
        });
    };

    schema.methods.releaseLock = function releaseLock(callback) {
        var self = this;
        if (!self.lockTimer) {
            return callback(new Error("Releasing lock on an object that haven't aquired lock or was allready released"))
        }
        clearTimeout(self.lockTimer);
        self.lockTimer = null;
        self[lockColumnName] = null;
        self.save(callback);
    };
}

module.exports = documentLock;