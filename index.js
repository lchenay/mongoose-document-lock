'use strict';

function documentLock(schema, options) {
    options = options || {};
    //in ms
    var LOCK_TIME_FIRE = options.lockTimeFire || 1000;
    var lockColumnName = "lockExpirationDate";

    //TODO: use curstom lock columns
    var data = {};
    data[lockColumnName] = Date;
    schema.add(data);

    schema.methods.takeLock = function takeLock(callback) {
        var self = this;
        var expirationDate = new Date();
        expirationDate.setSeconds(expirationDate.getSeconds() + LOCK_TIME_FIRE / 1000);

        var maxDBExpirationDate = new Date();
        maxDBExpirationDate.setSeconds(expirationDate.getSeconds() - LOCK_TIME_FIRE / 1000);

        var query1 = {_id: self._id};
        var query2 = {_id: self._id};

        query1[lockColumnName] = null;
        query2[lockColumnName] = {$lt: maxDBExpirationDate};

        var query = {$or: [query1, query2]};

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
        self.takeLock(function(err) {
            if (err) {
                return callback(err)
            }
            self.lockTimer = setInterval(function() {
                self.takeLock()
            }, LOCK_TIME_FIRE / 2);
            callback();
        })
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