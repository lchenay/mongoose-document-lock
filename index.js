'use strict';

function documentLock(schema, options) {
    options = options || {lockColumnNames: ["lockExpirationDate"]};
    //in ms
    var LOCK_TIME_FIRE = options.lockTimeFire || 1000;

    if (options.lockColumnNames.length == 0) {
        throw new Error("Can't initiate document lock without lock column.")
    }

    var data = {};
    options.lockColumnNames.forEach(function(columnName) {
        data[columnName] = Date;
    });
    schema.add(data);

    schema.methods.takeLock = function takeLock(columnName, callback) {
        var self = this;
        var expirationDate = new Date();
        expirationDate.setSeconds(expirationDate.getSeconds() + LOCK_TIME_FIRE / 1000);

        var maxDBExpirationDate = new Date();
        maxDBExpirationDate.setSeconds(expirationDate.getSeconds() - LOCK_TIME_FIRE / 1000);

        var query1 = {_id: self._id};
        var query2 = {_id: self._id};

        query1[columnName] = null;
        query2[columnName] = {$lt: maxDBExpirationDate};

        var query = {$or: [query1, query2]};

        var update = {};
        update[columnName] = expirationDate;

        self.model(self.constructor.modelName).update(query, update, function(err, numAffected) {
            if (numAffected != 1) {
                return callback(new Error("Unable to take lock. Someone take it before us"));
            }

            self[columnName] = expirationDate;

            callback();
        });
    };

    schema.methods.getLock = function getLock(columnName, callback) {
        if (typeof columnName == "function") {
            callback = columnName;
            columnName = options.lockColumnNames[0]
        }

        var self = this;
        self.takeLock(columnName, function(err) {
            if (err) {
                return callback(err)
            }
            if (!self.lockTimer) {
                self.lockTimer = {}
            }

            self.lockTimer[columnName] = setInterval(function() {
                self.takeLock(columnName, function() {})
            }, LOCK_TIME_FIRE / 2);
            callback();
        })
    };

    schema.methods.releaseLock = function releaseLock(columnName, callback) {
        if (typeof columnName == "function") {
            callback = columnName
            columnName = options.lockColumnNames[0]
        }

        var self = this;
        if (!self.lockTimer || !self.lockTimer[columnName]) {
            return callback(new Error("Releasing lock on an object that haven't aquired lock or was allready released"))
        }
        clearTimeout(self.lockTimer[columnName]);
        self.lockTimer[columnName] = null;

        var query = {_id: self._id};
        query[columnName] = self[columnName];

        var update = {};
        update[columnName] = null;

        self.model(self.constructor.modelName).update(query, update, function(err, numAffected) {
            if (numAffected != 1) {
                return callback(new Error("Unable to release lock. Someone change it before us."));
            }

            self[columnName] = null;
            callback()
        });
    };
}

module.exports = documentLock;