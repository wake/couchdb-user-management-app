/* global couchDbUserManagementApp */
couchDbUserManagementApp.service('database', ['$http', '$q', function ($http, $q) {
  'use strict';
  var baseUrl;
  var headers = {};

  return {
    setBaseUrl: function(url) {
      baseUrl = url.replace(/\/$/, '');
    },
    checkSession: function() {
      var promise = $http({
        url: baseUrl + '/_session',
        headers: headers,
        withCredentials: true
      });
      return promise.then(function(response){
        var isAdmin = response.data.userCtx.roles.indexOf('_admin') !== -1;
        if (isAdmin) {
          return response.data.userCtx.name;
        }

        throw new Error('not signed in.');
      });
    },
    signIn: function(options) {
      var promise = $http({
        method: 'post',
        url: baseUrl + '/_session',
        data: {
          name: options.username,
          password: options.password
        },
        withCredentials: true
      });
      return promise.then(function() {
        headers = {'Authorization': 'Basic ' + btoa(options.username + ':' + options.password)};
        return options.username;
      }, function(response) {
        var error = new Error(response.data.reason);
        error.name = response.data.error;
        error.status = response.data.status;
        throw error;
      });
    },
    signOut: function() {
      var promise = $http({
        method: 'delete',
        url: baseUrl + '/_session',
        headers: headers,
        withCredentials: true
      });
      return promise.catch(function(response) {
        var error = new Error(response.data.reason);
        error.name = response.data.error;
        error.status = response.data.status;
        throw error;
      });
    },
    getUsers: function () {
      var promise = $http({
        url: baseUrl + '/_users/_all_docs?include_docs=true&startkey=%22org.couchdb.user:%22&endkey=%22org.couchdb.user:|%22',
        headers: headers,
        withCredentials: true
      });
      return promise.then(function (response) {
        return response.data.rows.map(function(row){
          return {
            username: row.doc.name,
            roles: row.doc.roles
          };
        });
      });
    },
    addUser: function (options) {
      var id = 'org.couchdb.user:'+options.username;
      var promise = $http({
        method: 'put',
        url: baseUrl + '/_users/' + encodeURIComponent(id),
        headers: headers,
        data: {
          _id: id,
          name: options.username,
          password: options.password,
          roles: options.roles,
          type: 'user',
        },
        withCredentials: true
      });
      return promise.then(function () {
        delete options.password;
        return options;
      });
    },
    updateUser: function(username, options) {
      var id = 'org.couchdb.user:'+username;
      var database = this;

      return $http({
        method: 'get',
        url: baseUrl + '/_users/' + encodeURIComponent(id),
        headers: headers,
        withCredentials: true
      }).then(function(response) {
        var userObject = response.data;
        userObject.roles = options.roles;
        if (options.password) {
          userObject.password = options.password;
        }
        if (options.username && username !== options.username) {
          userObject._id = 'org.couchdb.user:'+ options.username;
          delete userObject._rev;
          userObject.name = options.username;
          return $q.all([
            $http({
              method: 'put',
              url: baseUrl + '/_users/' + encodeURIComponent(userObject._id),
              headers: headers,
              data: userObject,
              withCredentials: true
            }),
            database.removeUser(username)
          ]);
        }

        return $http({
          method: 'put',
          url: baseUrl + '/_users/' + encodeURIComponent(id),
          headers: headers,
          data: userObject,
          withCredentials: true
        });
      }).then(function() {
        return {
          username: options.username || username,
          roles: options.roles
        };
      });
    },
    removeUser: function(username) {
      var id = 'org.couchdb.user:'+username;

      return $http({
        method: 'get',
        url: baseUrl + '/_users/' + encodeURIComponent(id),
        headers: headers,
        withCredentials: true
      }).then(function(response) {
        var userObject = response.data;

        userObject._deleted = true;
        return $http({
          method: 'put',
          url: baseUrl + '/_users/' + encodeURIComponent(id),
          headers: headers,
          data: userObject,
          withCredentials: true
        });
      }).then(function() {
        return username;
      });
    },

    getDatabases: function () {
      return $http({
        method: 'get',
        url: baseUrl + '/_all_dbs',
        headers: headers,
        withCredentials: true
      }).then(function(response) {
        var getAllDbSecurityPromises = response.data.filter(function(dbName) {
          // ignore databases starting with _
          return dbName[0] !== '_';
        }).map(function(dbName) {
          return $http({
            method: 'get',
            url: baseUrl + '/'+dbName+'/_security',
            headers: headers,
            withCredentials: true
          }).then(function(response) {
            var dbSecurity = response.data;
            dbSecurity.name = dbName;
            return dbSecurity;
          });
        });
        return $q.all(getAllDbSecurityPromises);
      });
    },
  };

}]);
