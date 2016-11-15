// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
/**
 * @unrestricted
 */
WebInspector.ServiceWorkerCacheView = class extends WebInspector.SimpleView {
  /**
   * @param {!WebInspector.ServiceWorkerCacheModel} model
   * @param {!WebInspector.ServiceWorkerCacheModel.Cache} cache
   */
  constructor(model, cache) {
    super(WebInspector.UIString('Cache'));
    this.registerRequiredCSS('resources/serviceWorkerCacheViews.css');

    this._model = model;

    this.element.classList.add('service-worker-cache-data-view');
    this.element.classList.add('storage-view');

    this._createEditorToolbar();

    this._refreshButton = new WebInspector.ToolbarButton(WebInspector.UIString('Refresh'), 'refresh-toolbar-item');
    this._refreshButton.addEventListener('click', this._refreshButtonClicked, this);

    this._pageSize = 50;
    this._skipCount = 0;

    this.update(cache);
    this._entries = [];
  }

  /**
   * @return {!WebInspector.DataGrid}
   */
  _createDataGrid() {
    var columns = /** @type {!Array<!WebInspector.DataGrid.ColumnDescriptor>} */ ([
      {id: 'number', title: WebInspector.UIString('#'), width: '50px'},
      {id: 'request', title: WebInspector.UIString('Request')},
      {id: 'response', title: WebInspector.UIString('Response')}
    ]);
    return new WebInspector.DataGrid(
        columns, undefined, this._deleteButtonClicked.bind(this), this._updateData.bind(this, true));
  }

  _createEditorToolbar() {
    var editorToolbar = new WebInspector.Toolbar('data-view-toolbar', this.element);

    this._pageBackButton =
        new WebInspector.ToolbarButton(WebInspector.UIString('Show previous page'), 'play-backwards-toolbar-item');
    this._pageBackButton.addEventListener('click', this._pageBackButtonClicked, this);
    editorToolbar.appendToolbarItem(this._pageBackButton);

    this._pageForwardButton =
        new WebInspector.ToolbarButton(WebInspector.UIString('Show next page'), 'play-toolbar-item');
    this._pageForwardButton.setEnabled(false);
    this._pageForwardButton.addEventListener('click', this._pageForwardButtonClicked, this);
    editorToolbar.appendToolbarItem(this._pageForwardButton);
  }

  _pageBackButtonClicked() {
    this._skipCount = Math.max(0, this._skipCount - this._pageSize);
    this._updateData(false);
  }

  _pageForwardButtonClicked() {
    this._skipCount = this._skipCount + this._pageSize;
    this._updateData(false);
  }

  /**
   * @param {!WebInspector.DataGridNode} node
   */
  _deleteButtonClicked(node) {
    this._model.deleteCacheEntry(this._cache, /** @type {string} */ (node.data['request']), node.remove.bind(node));
  }

  /**
   * @param {!WebInspector.ServiceWorkerCacheModel.Cache} cache
   */
  update(cache) {
    this._cache = cache;

    if (this._dataGrid)
      this._dataGrid.asWidget().detach();
    this._dataGrid = this._createDataGrid();
    this._dataGrid.asWidget().show(this.element);
    this._skipCount = 0;
    this._updateData(true);
  }

  /**
   * @param {number} skipCount
   * @param {!Array.<!WebInspector.ServiceWorkerCacheModel.Entry>} entries
   * @param {boolean} hasMore
   * @this {WebInspector.ServiceWorkerCacheView}
   */
  _updateDataCallback(skipCount, entries, hasMore) {
    this._refreshButton.setEnabled(true);
    this.clear();
    this._entries = entries;
    for (var i = 0; i < entries.length; ++i) {
      var data = {};
      data['number'] = i + skipCount;
      data['request'] = entries[i].request;
      data['response'] = entries[i].response;
      var node = new WebInspector.DataGridNode(data);
      node.selectable = true;
      this._dataGrid.rootNode().appendChild(node);
    }
    this._pageBackButton.setEnabled(!!skipCount);
    this._pageForwardButton.setEnabled(hasMore);
  }

  /**
   * @param {boolean} force
   */
  _updateData(force) {
    var pageSize = this._pageSize;
    var skipCount = this._skipCount;
    this._refreshButton.setEnabled(false);

    if (!force && this._lastPageSize === pageSize && this._lastSkipCount === skipCount)
      return;

    if (this._lastPageSize !== pageSize) {
      skipCount = 0;
      this._skipCount = 0;
    }
    this._lastPageSize = pageSize;
    this._lastSkipCount = skipCount;
    this._model.loadCacheData(this._cache, skipCount, pageSize, this._updateDataCallback.bind(this, skipCount));
  }

  _refreshButtonClicked(event) {
    this._updateData(true);
  }

  /**
   * @override
   * @return {!Array.<!WebInspector.ToolbarItem>}
   */
  syncToolbarItems() {
    return [this._refreshButton];
  }

  clear() {
    this._dataGrid.rootNode().removeChildren();
    this._entries = [];
  }
};