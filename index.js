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

    
    function exec(query, update, columnName, expirationDate, callback) {
        var self = this;
        self.model(self.constructor.modelName).update(query, update, function(err, numAffected) {
            if (err) {
                return callback(err)
            }

            if (numAffected != 1) {
                return callback(new Error("Unable to take lock. Someone take it before us"));
            }

            self.set(columnName, expirationDate);

            callback();
        });
    }
    
    function forceLock(columnName, callback) {
        var expirationDate = new Date();
        expirationDate.setSeconds(expirationDate.getSeconds() + LOCK_TIME_FIRE / 1000);

        var query = {_id: this._id};

        var update = {$set: {}};
        update["$set"][columnName] = expirationDate;

        exec.call(this, query, update, columnName, expirationDate, callback)
    };
    
    schema.methods.takeLock = function takeLock(columnName, callback) {
        var expirationDate = new Date();
        expirationDate.setSeconds(expirationDate.getSeconds() + LOCK_TIME_FIRE / 1000);

        var maxDBExpirationDate = new Date();

        var query1 = {_id: this._id};
        var query2 = {_id: this._id};

        query1[columnName] = null;
        query2[columnName] = {$lt: maxDBExpirationDate};

        var query = {$or: [query1, query2]};

        var update = {$set: {}};
        update["$set"][columnName] = expirationDate;
        exec.call(this, query, update, columnName, expirationDate, callback)
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
                forceLock.call(self, columnName, function() {})
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
        query[columnName] = self.get(columnName);

        var update = {};
        update[columnName] = null;

        self.model(self.constructor.modelName).update(query, update, function(err, numAffected) {
            if (numAffected != 1) {
                return callback(new Error("Unable to release lock. Someone change it before us."));
            }

            self.set(columnName, null)
            callback()
        });
    };

    schema.methods.isLocked = function isLocked(columnName, callback) {
        if (typeof columnName == "function") {
            callback = columnName
            columnName = options.lockColumnNames[0]
        }

        var today = new Date()

        if (this.get(columnName) > today) {
            return true
        }
        return false
    };
}

module.exports = documentLock;
