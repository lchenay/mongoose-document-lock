'use strict';

var mongoose = require('mongoose');
var documentLock = require('../');
var async = require('async');
var assert = require('assert');

describe('Document Lock', function() {
    var db;

    before(function(done) {
        mongoose.connect('mongodb://127.0.0.1/documentLock');
        db = mongoose.connection.db;
        done()
    });

    after(function (done) {
        db.dropDatabase(function () {
            done();
        });
    });

    describe('Mongoose plugins', function() {
        it('Should fail if model don\'t fit all requirement', function() {

        });

        it('Should register function to model', function() {
            var Schema =  new mongoose.Schema({});
            Schema.plugin(documentLock);
            var Model = mongoose.model('Model1', Schema);
            var object = new Model();

            assert(object.getLock);
            assert(object.isLocked);
            assert(object.releaseLock);
         });
    });

    describe('Lock function', function() {
        var object;
        var instance2;
        before(function(done) {
            var Schema = new mongoose.Schema({name: String});
            Schema.plugin(documentLock);
            var Model = mongoose.model('Model2', Schema);
            object = new Model();
            object.name = "Locked object";
            object.save(function() {
                Model.findOne({_id: object._id}, function(err, obj) {
                    assert(!err, err);
                    instance2 = obj;
                    done()
                });
            });
        });

        it('should lock this object for other instance', function(done) {
            async.waterfall([
                function(next) {
                    object.getLock(next);
                }, function(next) {
                    instance2.isLocked(function (err, result) {
                        assert(!err, err);
                        assert(result);
                        object.releaseLock(function(err) {
                            assert(!err, err);
                            instance2.isLocked(function(err, result) {
                                assert(!err, err);
                                assert(!result);
                                next()
                            });
                        })
                    });
                }
            ], done);
        });

        it('should be protected for 2 getLock at the same time', function(done) {
            async.parallel([
                function(next) {
                    //This should take the lock
                    object.getLock(function(err) {
                        assert(!err, err);
                        next()
                    });
                },
                function(next) {
                    //This should fail even if it's done in parallel
                    instance2.getLock(function(err) {
                        assert(err, err);
                        next()
                    });
                }
            ], done)
        });
    });
});