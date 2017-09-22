var _ = require('underscore-cdb-v3');
var cdb = require('cartodb.js-v3');
var PagesSubheader = require('./pages_subheader');
var ProfileFormView = require('./profile_form_view');

module.exports = cdb.core.View.extend({
  initialize: function () {
    _.each(['flashMessageModel'], function (name) {
      if (!this.options[name]) throw new Error(name + ' is required');
    }, this);

    this.template = cdb.templates.getTemplate('profile/views/profile_content');

    this._initModels();
  },

  _initBinds: function () {
    this.model.on('change:isLoading', this.render, this);
  },

  render: function () {
    this.clearSubViews();
    this.$el.html(this.template());

    this._initViews();

    return this;
  },

  _initModels: function () {
    this.user = this.options.user;
    this.model = new cdb.core.Model();
  },

  _initViews: function () {
    var pagesSubheader = new PagesSubheader({
      user: this.user
    });
    this.$('.js-SideMenu').append(pagesSubheader.render().el);

    var profileFormView = new ProfileFormView({
      user: this.user,
      setLoading: this._setLoading.bind(this),
      onSaved: this._showSuccess.bind(this),
      onError: this._showErrors.bind(this),
      renderModel: this.model
    });
    this.$('.js-ProfileContent').append(profileFormView.render().el);
  },

  _setLoading: function (message) {
    this.options.flashMessageModel.hide();

    this.model.set({
      isLoading: !!message,
      loadingText: message
    });
  },

  _setFlashMessage: function (res, message, type) {
    this._setLoading('');

    var str;
    try {
      str = res && JSON.parse(res.responseText).errors.join('. ');
    } catch (err) {
      str = message;
    }

    this.options.flashMessageModel.show(str, type);
  },

  _showSuccess: function (message, response, request) {
    this._setFlashMessage(response, 'Your changes have been saved correctly.', 'success');
  },

  _showErrors: function (message, response, request) {
    this._setFlashMessage(response, 'Could not save profile, please try again.', 'error');
  }
});