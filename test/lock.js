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
                    instance2.getLock(function (err) {
                        assert(err, err);
                        object.releaseLock(function(err) {
                            assert(!err, err);
                            instance2.getLock(function(err) {
                                assert(!err, err);
                                instance2.releaseLock(next)
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

        it('should allow me to get lock on 2 differents columns', function(done) {
            var Schema = new mongoose.Schema({name: String});
            Schema.plugin(documentLock, {lockColumnNames: ["column1", "column2"]});
            var Model = mongoose.model('Model3', Schema);
            var object = new Model();
            object.name = "Locked object";
            object.save(function() {
                object.getLock("column1", function(err) {
                    assert(!err, err);
                    object.getLock("column2", function(err) {
                        assert(!err, err);
                        object.getLock("column1", function(err) {
                            assert(err, err);
                            object.releaseLock("column1", function(err) {
                                assert(!err, err);
                                object.getLock("column2", function(err) {
                                    assert(err, err);
                                    object.releaseLock("column2", function(err) {
                                        assert(!err, err);
                                        done();
                                    })
                                })
                            })
                        })
                    })
                })
            });
        });
    });
});