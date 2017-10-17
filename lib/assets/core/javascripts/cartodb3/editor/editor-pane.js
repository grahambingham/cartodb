var $ = require('jquery');
var Backbone = require('backbone');
var _ = require('underscore');
var CoreView = require('backbone/core-view');
var createTextLabelsTabPane = require('../components/tab-pane/create-text-labels-tab-pane');
var AddWidgetsView = require('../components/modals/add-widgets/add-widgets-view');
var AddLayerView = require('../components/modals/add-layer/add-layer-view');
var AddLayerModel = require('../components/modals/add-layer/add-layer-model');
var StackLayoutView = require('../components/stack-layout/stack-layout-view');
var Header = require('./editor-header.js');
var EditorTabPaneTemplate = require('./editor-tab-pane.tpl');
var EditorWidgetsView = require('./widgets/widgets-view');
var LayersView = require('./layers/layers-view');
var ScrollView = require('../components/scroll/scroll-view');
var PanelWithOptionsView = require('../components/view-options/panel-with-options-view');
var ShareButtonView = require('./layers/share-button-view');
var PublishView = require('../components/modals/publish/publish-view');
var checkAndBuildOpts = require('../helpers/required-opts');
var Infobox = require('../components/infobox/infobox-factory');
var InfoboxModel = require('../components/infobox/infobox-model');
var InfoboxCollection = require('../components/infobox/infobox-collection');
var TipsyTooltipView = require('../components/tipsy-tooltip-view');
var AppNotifications = require('../app-notifications');

var REQUIRED_OPTS = [
  'userActions',
  'modals',
  'configModel',
  'userModel',
  'editorModel',
  'pollingModel',
  'analysisDefinitionNodesCollection',
  'layerDefinitionsCollection',
  'privacyCollection',
  'widgetDefinitionsCollection',
  'mapcapsCollection',
  'visDefinitionModel',
  'mapStackLayoutModel',
  'stateDefinitionModel',
  'selectedTabItem'
];

var LAYERS_TAB_NAME = 'layers';
var MAX_LAYERS_REACHED = 'MAX_LAYERS_REACHED';

module.exports = CoreView.extend({

  className: 'Editor-content',

  events: {
    'click .js-add': '_addItem'
  },

  initialize: function (opts) {
    checkAndBuildOpts(opts, REQUIRED_OPTS, this);

    this._initModels();
    this._initBinds();
  },

  render: function () {
    var self = this;

    var count = this._getDataLayerCount();
    var max = this._getMaxCount();

    this.clearSubViews();
    this.$el.empty();

    var infoboxStates = [
      this._getMaxLayerInfoBoxForCurrentUser(),
      this._getLimitInfobox()
    ];

    this._infoboxModel = new InfoboxModel({
      state: null
    });

    var infoboxCollection = new InfoboxCollection(infoboxStates);

    var tabPaneTabs = [{
      name: LAYERS_TAB_NAME,
      label: this._getTranslatedLayersLabel(count, max),
      selected: this._selectedTabItem === LAYERS_TAB_NAME,
      createContentView: function () {
        var layersStackViewCollection = new Backbone.Collection([{
          createStackView: function (stackLayoutModel, opts) {
            return new PanelWithOptionsView({
              className: 'Editor-content js-editorPanelContent',
              editorModel: self._editorModel,
              infoboxModel: self._infoboxModel,
              infoboxCollection: infoboxCollection,
              createContentView: function () {
                return new ScrollView({
                  createContentView: function () {
                    return new LayersView({
                      modals: self._modals,
                      userModel: self._userModel,
                      editorModel: self._editorModel,
                      configModel: self._configModel,
                      userActions: self._userActions,
                      layerDefinitionsCollection: self._layerDefinitionsCollection,
                      analysisDefinitionNodesCollection: self._analysisDefinitionNodesCollection,
                      stackLayoutModel: self._mapStackLayoutModel,
                      stateDefinitionModel: self._stateDefinitionModel,
                      widgetDefinitionsCollection: self._widgetDefinitionsCollection,
                      visDefinitionModel: self._visDefinitionModel,
                      showMaxLayerError: self._infoboxState.bind(self)
                    });
                  }
                });
              },
              createActionView: function () {
                return new ShareButtonView({
                  visDefinitionModel: self._visDefinitionModel,
                  onClickAction: self._share.bind(self)
                });
              }
            });
          }
        }]);

        return new StackLayoutView({
          className: 'Editor-content',
          collection: layersStackViewCollection
        });
      }
    }, {
      name: 'widgets',
      label: _t('editor.tab-pane.widgets.title-label'),
      selected: this._selectedTabItem === 'widgets',
      createContentView: function () {
        var widgetsStackViewCollection = new Backbone.Collection([{
          createStackView: function (stackLayoutModel, opts) {
            return new PanelWithOptionsView({
              className: 'Editor-content',
              editorModel: self._editorModel,
              infoboxModel: self._infoboxModel,
              infoboxCollection: infoboxCollection,
              createContentView: function () {
                return new ScrollView({
                  createContentView: function () {
                    return new EditorWidgetsView({
                      userActions: self._userActions,
                      modals: self._modals,
                      layerDefinitionsCollection: self._layerDefinitionsCollection,
                      widgetDefinitionsCollection: self._widgetDefinitionsCollection,
                      stackLayoutModel: self._mapStackLayoutModel
                    });
                  }
                });
              },
              createActionView: function () {
                return new ShareButtonView({
                  visDefinitionModel: self._visDefinitionModel,
                  onClickAction: self._share.bind(self)
                });
              }
            });
          }
        }]);

        return new StackLayoutView({
          className: 'Editor-content',
          collection: widgetsStackViewCollection
        });
      }
    }];

    var header = new Header({
      editorModel: self._editorModel,
      mapcapsCollection: self._mapcapsCollection,
      modals: self._modals,
      visDefinitionModel: self._visDefinitionModel,
      privacyCollection: self._privacyCollection,
      onClickPrivacy: self._share.bind(self),
      onRemoveMap: self._onRemoveMap.bind(self),
      configModel: self._configModel,
      userModel: self._userModel
    });

    header.bind('export-image', this._onExportImage, this);

    this.$el.append(header.render().$el);
    this.addView(header);

    var tabPaneOptions = {
      tabPaneOptions: {
        template: EditorTabPaneTemplate,
        tabPaneItemOptions: {
          tagName: 'li',
          className: 'CDB-NavMenu-item'
        }
      },
      tabPaneItemLabelOptions: {
        tagName: 'button',
        className: 'CDB-NavMenu-link u-upperCase'
      }
    };

    this._mapTabPaneView = createTextLabelsTabPane(tabPaneTabs, tabPaneOptions);
    this._mapTabPaneView.collection.bind('change:selected', this._updateAddButtonState, this);

    this.$el.append(this._mapTabPaneView.render().$el);
    this.addView(this._mapTabPaneView);

    this._updateAddButtonState();

    var tooltip = new TipsyTooltipView({
      el: this.$('.js-add'),
      title: function () {
        return this._tooltipTitle;
      }.bind(this)
    });
    this.addView(tooltip);

    this._infoboxState();

    return this;
  },

  _initModels: function () {
    this._updatedModel = new Backbone.Model({
      date: ''
    });
  },

  _initBinds: function () {
    this.listenTo(this._widgetDefinitionsCollection, 'reset remove add', this._updateAddButtonState);
    this.listenTo(this._editorModel, 'change:edition', this._changeStyle);
    this.listenTo(this._layerDefinitionsCollection, 'reset remove add', this._updateAddButtonState);
    this.listenTo(this._layerDefinitionsCollection, 'add', function () {
      this._visDefinitionModel.fetch();
    });
    this.listenTo(this._layerDefinitionsCollection, 'add remove', this._onLayerCountChange);
    this.listenTo(AppNotifications.getCollection(), 'add', this._infoboxState);
  },

  _getMaxLayerTitle: function () {
    return _t('editor.layers.max-layers-infowindow.title');
  },

  _getMaxLayerInfoBoxForCurrentUser: function () {
    var infoboxOpts = {
      type: 'alert',
      title: this._getMaxLayerTitle()
    };

    var baseState = {
      state: MAX_LAYERS_REACHED
    };

    // Open-source / local installation
    if (this._configModel.isHosted()) {
      infoboxOpts.body = _t('editor.layers.max-layers-infowindow.custom.body', { maxLayers: this._getMaxCount() });
      infoboxOpts.mainAction = { label: _t('editor.layers.max-layers-infowindow.custom.contact') };
      baseState.mainAction = function () { window.open(_t('editor.layers.max-layers-infowindow.custom.contact-url')); };
    } else {
      if (this._userModel.isInsideOrg()) {
        if (this._userModel.isOrgAdmin()) {
          infoboxOpts.body = _t('editor.layers.max-layers-infowindow.org-admin.body', { maxLayers: this._getMaxCount() });
          infoboxOpts.mainAction = { label: _t('editor.layers.max-layers-infowindow.org-admin.upgrade') };
        } else {
          infoboxOpts.body = _t('editor.layers.max-layers-infowindow.org.body', { maxLayers: this._getMaxCount() });
          infoboxOpts.mainAction = { label: _t('editor.layers.max-layers-infowindow.org.upgrade') };
        }

        baseState.mainAction = function () { window.open('mailto:' + this._userModel.upgradeContactEmail()); };
      } else {
        baseState.mainAction = function () { window.open(_t('editor.layers.max-layers-infowindow.pricing')); };
        infoboxOpts.body = _t('editor.layers.max-layers-infowindow.regular.body', { maxLayers: this._getMaxCount() });
        infoboxOpts.mainAction = { label: _t('editor.layers.max-layers-infowindow.regular.upgrade') };
      }
    }

    return _.extend(baseState, {
      createContentView: function () {
        return Infobox.createWithAction(infoboxOpts);
      }
    });
  },

  _getLimitInfobox: function () {
    var infoboxOpts = {
      type: 'alert',
      title: _t('editor.messages.limit.title'),
      body: _t('editor.messages.limit.body')
    };

    var baseState = {
      state: 'limit'
    };

    if (!this._configModel.isHosted()) {
      baseState.secondAction = function () {
        window.open(_t('editor.messages.limit.cta.url'));
      };
      infoboxOpts.secondAction = {
        label: _t('editor.messages.limit.cta.label'),
        type: 'secondary'
      };
      infoboxOpts.body = _t('editor.messages.limit.body') + _t('editor.messages.limit.try_to');
    }

    return _.extend(baseState, {
      createContentView: function () {
        return Infobox.createWithAction(infoboxOpts);
      }
    });
  },

  _onLayerCountChange: function () {
    var count = this._getDataLayerCount();
    var max = this._getMaxCount();

    var layersModel = this._mapTabPaneView.getTabPaneCollection().find(function (model) {
      return model.get('name') === LAYERS_TAB_NAME;
    });

    layersModel.set('label', this._getTranslatedLayersLabel(count, max));

    if (count === max) {
      this._disableAddButton();
      this._infoboxState();
    } else {
      this._enableAddButton();
      this._infoboxModel.set('state', null);
    }
  },

  _infoboxState: function () {
    var count = this._getDataLayerCount();
    var max = this._getMaxCount();
    var hasLimitError = AppNotifications.getByType('limit');

    if (hasLimitError) {
      this._infoboxModel.set('state', 'limit');
    } else if (count === max) {
      this._infoboxModel.set('state', MAX_LAYERS_REACHED);
    } else {
      this._infoboxModel.set('state', null);
    }
  },

  _onExportImage: function () {
    this.trigger('export-image', this);
  },

  _onRemoveMap: function () {
    window.location = this._userModel.get('base_url');
  },

  _getDataLayerCount: function () {
    return this._layerDefinitionsCollection.getNumberOfDataLayers();
  },

  _getMaxCount: function () {
    return this._userModel.get('limits').max_layers;
  },

  _getTranslatedLayersLabel: function (count, max) {
    return _t('editor.tab-pane.layers.title-label', {
      count: count,
      maxCount: max
    });
  },

  _enableAddButton: function () {
    this.$('.js-add').removeClass('is-disabled');
  },

  _disableAddButton: function () {
    this.$('.js-add').addClass('is-disabled');
  },

  _hideAddButton: function () {
    this.$('.js-add').addClass('is-hidden');
  },

  _showAddButton: function () {
    this.$('.js-add').removeClass('is-hidden');
  },

  _updateAddButtonState: function () {
    this._hideAddButton();

    switch (this._mapTabPaneView.getSelectedTabPaneName()) {
      case 'widgets':
        this._tooltipTitle = '';
        if (this._widgetDefinitionsCollection.size()) {
          this._showAddButton();
        }
        this._enableAddButton();
        break;
      case LAYERS_TAB_NAME:
        var count = this._getDataLayerCount();
        var max = this._getMaxCount();

        if (this._layerDefinitionsCollection.size()) {
          this._showAddButton();
        }
        if (count === max) {
          this._disableAddButton();
          this._tooltipTitle = this._getMaxLayerTitle();
        } else {
          this._enableAddButton();
          this._tooltipTitle = '';
        }
        break;
      case 'elements':
        // TODO: trigger element creation
        break;
    }
  },

  _addItem: function () {
    // We have to manually ignore these events because a disabled button won't trigger mouseover either => no tooltips
    if (this.$('.js-add').hasClass('is-disabled')) return;
    switch (this._mapTabPaneView.getSelectedTabPaneName()) {
      case LAYERS_TAB_NAME: return this._addLayer();
      case 'widgets': return this._addWidget();
    }
  },

  _addLayer: function () {
    var self = this;
    var modal = this._modals.create(function (modalModel) {
      var addLayerModel = new AddLayerModel({}, {
        userModel: self._userModel,
        userActions: self._userActions,
        configModel: self._configModel,
        pollingModel: self._pollingModel
      });

      return new AddLayerView({
        modalModel: modalModel,
        configModel: self._configModel,
        userModel: self._userModel,
        createModel: addLayerModel,
        pollingModel: self._pollingModel
      });
    });
    modal.show();
  },

  _addWidget: function () {
    var self = this;

    this._modals.create(function (modalModel) {
      return new AddWidgetsView({
        modalModel: modalModel,
        userModel: self._userModel,
        userActions: self._userActions,
        configModel: self._configModel,
        analysisDefinitionNodesCollection: self._analysisDefinitionNodesCollection,
        layerDefinitionsCollection: self._layerDefinitionsCollection,
        widgetDefinitionsCollection: self._widgetDefinitionsCollection
      });
    });
  },

  _share: function () {
    var self = this;

    this._modals.create(function (modalModel) {
      return new PublishView({
        mapcapsCollection: self._mapcapsCollection,
        modalModel: modalModel,
        visDefinitionModel: self._visDefinitionModel,
        privacyCollection: self._privacyCollection,
        userModel: self._userModel,
        configModel: self._configModel
      });
    });
  },

  _changeStyle: function (m) {
    this.$el.toggleClass('is-dark');
    this._mapTabPaneView.changeStyleMenu(m);
  },

  _setUpdateFromCreation: function () {
    this._updatedModel.set({date: this._visDefinitionModel.get('created_at')});
  },

  _setUpdateFromMapcap: function (mapcaps) {
    this._updatedModel.set({date: mapcaps[0].created_at});
  },

  _getMapcaps: function () {
    var updateFromCreation = this._setUpdateFromCreation.bind(this);
    var updateFromMapcap = this._setUpdateFromMapcap.bind(this);
    var url = this._visDefinitionModel.mapcapsURL();
    var data = {
      api_key: this._configModel.get('api_key')
    };

    $.get(url, data)
      .done(function (data) {
        if (data.length > 0) {
          updateFromMapcap(data);
        } else {
          updateFromCreation();
        }
      })
      .fail(function () {
        updateFromCreation();
      });
  }
});
