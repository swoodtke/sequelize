var config            = require("./config/config")
  , Sequelize         = require("../index")
  , Utils             = require("../lib/utils")
  , dialects          = ['postgres', 'mysql', 'sqlite']

describe('Transactions', function() {
  dialects.forEach(function(dialect) {
    describe('with dialect "' + dialect + '"', function() {
      var sequelize = new Sequelize(
          config[dialect].database,
          config[dialect].username,
          config[dialect].password,
          {
            logging: false,
            dialect: dialect,
            port: config[dialect].port
          }
        )
      , Helpers     = new (require("./config/helpers"))(sequelize)
      , Account     = null

      var setup = function() {
        Helpers.async(function(done) {
          Account = sequelize.define('Account', { name: Sequelize.STRING, balance: Sequelize.INTEGER })
          Account.sync({ force: true }).success(function() {
            Account.build({ name: 'checking', balance: 100 }).save().success(done);
          });
        });
      }

      beforeEach(function() { Helpers.dropAllTables(); setup() })
      afterEach(function() { })

      describe('transaction basics', function() {
        it('it should call the success callback', function() {
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .run()
              .success(function() {
                done();
              })
          })
        })

        it('it should call the success callback with one action using emitter', function() {
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function() {
                return Account.all();
              })
              .run()
              .success(function() {
                done();
              })
          })
        })

        it('it should call the success callback with one action using callback', function() {
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function(cb) {
                Account.all().success(function() { cb(null); })
              })
              .run()
              .success(function() {
                done();
              })
          })
        })


        it('it should call the failure callback on error using emitter', function() {
          var errorMessage = 'this is the failure message!'
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function() {
                return new Utils.CustomEventEmitter(function(emitter) {
                  Account.all().success(function() {
                    emitter.emit('failure', errorMessage)
                  });
                }).run()
              })
              .run()
              .error(function(err) {
                expect(err).toEqual(errorMessage)
                done();
              })
          })
        })

        it('it should call the failure callback on error using callback', function() {
          var errorMessage = 'this is the failure message!'
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function(cb) {
                Account.all().success(function() {
                  cb(errorMessage)
                });
              })
              .run()
              .error(function(err) {
                expect(err).toEqual(errorMessage)
                done();
              })
          })
        })

      })

      describe('transaction usage', function() {
        it('it should commit the change to the db using emitter', function() {
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function() {
                return new Utils.CustomEventEmitter(function(emitter) {
                  Account.find({ where: { name: 'checking' } }).success(function(account) {
                    account.balance -= 25
                    account.save().success(function() { emitter.emit('success'); })
                  })
                }).run()
              })
              .run()
              .success(function() {
                Account.find({ where: { name: 'checking' } }).success(function(a) {
                  expect(a.balance).toEqual(75)
                  done()
                })
              })
          })
        })

        it('it should commit the change to the db using callback', function() {
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function(cb) {
                Account.find({ where: { name: 'checking' } }).success(function(account) {
                  account.balance -= 25
                  account.save().success(function() { cb(null); })
                })
              })
              .run()
              .success(function() {
                Account.find({ where: { name: 'checking' } }).success(function(a) {
                  expect(a.balance).toEqual(75)
                  done()
                })
              })
          })
        })

        it('it should revert the change to the db using emitter', function() {
          var errorMessage = 'unable to save the account';
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function() {
                return new Utils.CustomEventEmitter(function(emitter) {
                  Account.find({ where: { name: 'checking' } }).success(function(account) {
                    account.balance -= 25
                    account.save().success(function() { emitter.emit('failure', errorMessage); })
                  })
                }).run()
              })
              .run()
              .error(function(err) {
                expect(err).toEqual(errorMessage);
                Account.find({ where: { name: 'checking' } }).success(function(a) {
                  expect(a.balance).toEqual(100)
                  done()
                })
              })
          })
        })

        it('it should revert the change to the db using callback', function() {
          var errorMessage = 'unable to save the account';
          Helpers.async(function(done) {
            sequelize.startTransaction()
              .add(function(cb) {
                Account.find({ where: { name: 'checking' } }).success(function(account) {
                  account.balance -= 25
                  account.save().success(function() { cb(errorMessage); })
                })
              })
              .run()
              .error(function(err) {
                expect(err).toEqual(errorMessage);
                Account.find({ where: { name: 'checking' } }).success(function(a) {
                  expect(a.balance).toEqual(100)
                  done()
                })
              })
          })
        })
      })
    })
  })
})
