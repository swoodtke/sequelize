var Utils = require('./utils')
var util = require('util')

module.exports = (function() {
  var QueryTransaction = function(sequelize) {
    this.sequelize = sequelize;
    this.actions = [];
  }
  util.inherits(QueryTransaction, Utils.CustomEventEmitter)
  
  QueryTransaction.prototype.add = function(action) {
    this.actions.push(action);
    return this;
  }

  QueryTransaction.prototype.run = function() {
    var self = this;
    if (this.actions.length == 0) {
      process.nextTick(function() { self.emit('success'); });
      return this;
    }

    this.sequelize.getQueryInterface().startTransaction().success(function() {
      runNextAction(self);
    }).error(function(err) {
      self.emit('failure', err);
    });

    return this;
  }

  function runNextAction(qt) {
    if (qt.actions.length == 0) {
      qt.sequelize.getQueryInterface().commitTransaction().success(function() {
        qt.emit('success');
      }).error(function(err) {
        qt.emit('failure', err);
      });
      return;
    }

    function handleActionError(err) {
      qt.sequelize.getQueryInterface().revertTransaction().success(function() {
        qt.emit('failure', err);
      }).error(function() {
        qt.emit('failure', err);
      });
    }

    function handleActionSuccess() {
      runNextAction(qt);
    }

    var action = qt.actions.shift();
    var emitter = action(function(err) {
      if (err) {
        handleActionError(err);
      } else {
        handleActionSuccess();
      }
    });

    if (emitter) {
      if (emitter.success) emitter.success(handleActionSuccess);
      if (emitter.error)   emitter.error(handleActionError);
    }
  }

  return QueryTransaction;
})()
