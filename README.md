mongoose-document-lock
======================

This plugin provides a locking feature on each document that can be used on non-thread safe part of your nodejs application.

It do not lock save for other thread. It's not intended for that but to lock some portion of code like:

```javascript
schema.methods.doSomeStuffThatIsNotThreadSafe(cb) {
    var self = this

    self.getLock(function(err) {
        if (err) {
        // We was unable to get the lock
            return cb(err);
        }

        self.doMyStuff(function() {
            self.releaseLock(cb)
        })
    })
}```