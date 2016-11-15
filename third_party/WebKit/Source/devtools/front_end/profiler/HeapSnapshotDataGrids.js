/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @unrestricted
 */
WebInspector.HeapSnapshotSortableDataGrid = class extends WebInspector.DataGrid {
  /**
   * @param {!WebInspector.ProfileType.DataDisplayDelegate} dataDisplayDelegate
   * @param {!Array.<!WebInspector.DataGrid.ColumnDescriptor>} columns
   */
  constructor(dataDisplayDelegate, columns) {
    super(columns);
    this._dataDisplayDelegate = dataDisplayDelegate;

    /**
     * @type {number}
     */
    this._recursiveSortingDepth = 0;
    /**
     * @type {?WebInspector.HeapSnapshotGridNode}
     */
    this._highlightedNode = null;
    /**
     * @type {boolean}
     */
    this._populatedAndSorted = false;
    /**
     * @type {?WebInspector.ToolbarInput}
     */
    this._nameFilter = null;
    this._nodeFilter = new WebInspector.HeapSnapshotCommon.NodeFilter();
    this.addEventListener(
        WebInspector.HeapSnapshotSortableDataGrid.Events.SortingComplete, this._sortingComplete, this);
    this.addEventListener(WebInspector.DataGrid.Events.SortingChanged, this.sortingChanged, this);
  }

  /**
   * @return {!WebInspector.HeapSnapshotCommon.NodeFilter}
   */
  nodeFilter() {
    return this._nodeFilter;
  }

  /**
   * @param {!WebInspector.ToolbarInput} nameFilter
   */
  setNameFilter(nameFilter) {
    this._nameFilter = nameFilter;
  }

  /**
   * @return {number}
   */
  defaultPopulateCount() {
    return 100;
  }

  _disposeAllNodes() {
    var children = this.topLevelNodes();
    for (var i = 0, l = children.length; i < l; ++i)
      children[i].dispose();
  }

  /**
   * @override
   */
  wasShown() {
    if (this._nameFilter) {
      this._nameFilter.addEventListener(WebInspector.ToolbarInput.Event.TextChanged, this._onNameFilterChanged, this);
      this.updateVisibleNodes(true);
    }
    if (this._populatedAndSorted)
      this.dispatchEventToListeners(WebInspector.HeapSnapshotSortableDataGrid.Events.ContentShown, this);
  }

  _sortingComplete() {
    this.removeEventListener(
        WebInspector.HeapSnapshotSortableDataGrid.Events.SortingComplete, this._sortingComplete, this);
    this._populatedAndSorted = true;
    this.dispatchEventToListeners(WebInspector.HeapSnapshotSortableDataGrid.Events.ContentShown, this);
  }

  /**
   * @override
   */
  willHide() {
    if (this._nameFilter)
      this._nameFilter.removeEventListener(
          WebInspector.ToolbarInput.Event.TextChanged, this._onNameFilterChanged, this);
    this._clearCurrentHighlight();
  }

  /**
   * @param {!WebInspector.ContextMenu} contextMenu
   * @param {!Event} event
   */
  populateContextMenu(contextMenu, event) {
    var td = event.target.enclosingNodeOrSelfWithNodeName('td');
    if (!td)
      return;
    var node = td.heapSnapshotNode;

    /**
     * @this {WebInspector.HeapSnapshotSortableDataGrid}
     */
    function revealInSummaryView() {
      this._dataDisplayDelegate.showObject(node.snapshotNodeId, 'Summary');
    }

    if (node instanceof WebInspector.HeapSnapshotRetainingObjectNode)
      contextMenu.appendItem(
          WebInspector.UIString.capitalize('Reveal in Summary ^view'), revealInSummaryView.bind(this));
  }

  resetSortingCache() {
    delete this._lastSortColumnId;
    delete this._lastSortAscending;
  }

  /**
   * @return {!Array.<!WebInspector.HeapSnapshotGridNode>}
   */
  topLevelNodes() {
    return this.rootNode().children;
  }

  /**
   * @param {!HeapProfilerAgent.HeapSnapshotObjectId} heapSnapshotObjectId
   * @return {!Promise<?WebInspector.HeapSnapshotGridNode>}
   */
  revealObjectByHeapSnapshotId(heapSnapshotObjectId) {
    return Promise.resolve(/** @type {?WebInspector.HeapSnapshotGridNode} */ (null));
  }

  /**
   * @param {!WebInspector.HeapSnapshotGridNode} node
   */
  highlightNode(node) {
    this._clearCurrentHighlight();
    this._highlightedNode = node;
    WebInspector.runCSSAnimationOnce(this._highlightedNode.element(), 'highlighted-row');
  }

  nodeWasDetached(node) {
    if (this._highlightedNode === node)
      this._clearCurrentHighlight();
  }

  _clearCurrentHighlight() {
    if (!this._highlightedNode)
      return;
    this._highlightedNode.element().classList.remove('highlighted-row');
    this._highlightedNode = null;
  }

  resetNameFilter() {
    this._nameFilter.setValue('');
  }

  _onNameFilterChanged() {
    this.updateVisibleNodes(true);
  }

  sortingChanged() {
    var sortAscending = this.isSortOrderAscending();
    var sortColumnId = this.sortColumnId();
    if (this._lastSortColumnId === sortColumnId && this._lastSortAscending === sortAscending)
      return;
    this._lastSortColumnId = sortColumnId;
    this._lastSortAscending = sortAscending;
    var sortFields = this._sortFields(sortColumnId, sortAscending);

    function SortByTwoFields(nodeA, nodeB) {
      var field1 = nodeA[sortFields[0]];
      var field2 = nodeB[sortFields[0]];
      var result = field1 < field2 ? -1 : (field1 > field2 ? 1 : 0);
      if (!sortFields[1])
        result = -result;
      if (result !== 0)
        return result;
      field1 = nodeA[sortFields[2]];
      field2 = nodeB[sortFields[2]];
      result = field1 < field2 ? -1 : (field1 > field2 ? 1 : 0);
      if (!sortFields[3])
        result = -result;
      return result;
    }
    this._performSorting(SortByTwoFields);
  }

  _performSorting(sortFunction) {
    this.recursiveSortingEnter();
    var children = this.allChildren(this.rootNode());
    this.rootNode().removeChildren();
    children.sort(sortFunction);
    for (var i = 0, l = children.length; i < l; ++i) {
      var child = children[i];
      this.appendChildAfterSorting(child);
      if (child.expanded)
        child.sort();
    }
    this.recursiveSortingLeave();
  }

  appendChildAfterSorting(child) {
    var revealed = child.revealed;
    this.rootNode().appendChild(child);
    child.revealed = revealed;
  }

  recursiveSortingEnter() {
    ++this._recursiveSortingDepth;
  }

  recursiveSortingLeave() {
    if (!this._recursiveSortingDepth)
      return;
    if (--this._recursiveSortingDepth)
      return;
    this.updateVisibleNodes(true);
    this.dispatchEventToListeners(WebInspector.HeapSnapshotSortableDataGrid.Events.SortingComplete);
  }

  /**
   * @param {boolean} force
   */
  updateVisibleNodes(force) {
  }

  /**
   * @param {!WebInspector.DataGridNode} parent
   * @return {!Array.<!WebInspector.HeapSnapshotGridNode>}
   */
  allChildren(parent) {
    return parent.children;
  }

  /**
   * @param {!WebInspector.DataGridNode} parent
   * @param {!WebInspector.DataGridNode} node
   * @param {number} index
   */
  insertChild(parent, node, index) {
    parent.insertChild(node, index);
  }

  /**
   * @param {!WebInspector.HeapSnapshotGridNode} parent
   * @param {number} index
   */
  removeChildByIndex(parent, index) {
    parent.removeChild(parent.children[index]);
  }

  /**
   * @param {!WebInspector.HeapSnapshotGridNode} parent
   */
  removeAllChildren(parent) {
    parent.removeChildren();
  }
};

/** @enum {symbol} */
WebInspector.HeapSnapshotSortableDataGrid.Events = {
  ContentShown: Symbol('ContentShown'),
  SortingComplete: Symbol('SortingComplete')
};

/**
 * @unrestricted
 */
WebInspector.HeapSnapshotViewportDataGrid = class extends WebInspector.HeapSnapshotSortableDataGrid {
  /**
   * @param {!WebInspector.ProfileType.DataDisplayDelegate} dataDisplayDelegate
   * @param {!Array.<!WebInspector.DataGrid.ColumnDescriptor>} columns
   */
  constructor(dataDisplayDelegate, columns) {
    super(dataDisplayDelegate, columns);
    this.scrollContainer.addEventListener('scroll', this._onScroll.bind(this), true);
    this._topPaddingHeight = 0;
    this._bottomPaddingHeight = 0;
  }

  /**
   * @override
   * @return {!Array.<!WebInspector.HeapSnapshotGridNode>}
   */
  topLevelNodes() {
    return this.allChildren(this.rootNode());
  }

  /**
   * @override
   */
  appendChildAfterSorting(child) {
    // Do nothing here, it will be added in updateVisibleNodes.
  }

  /**
   * @override
   * @param {boolean} force
   */
  updateVisibleNodes(force) {
    // Guard zone is used to ensure there are always some extra items
    // above and below the viewport to support keyboard navigation.
    var guardZoneHeight = 40;
    var scrollHeight = this.scrollContainer.scrollHeight;
    var scrollTop = this.scrollContainer.scrollTop;
    var scrollBottom = scrollHeight - scrollTop - this.scrollContainer.offsetHeight;
    scrollTop = Math.max(0, scrollTop - guardZoneHeight);
    scrollBottom = Math.max(0, scrollBottom - guardZoneHeight);
    var viewPortHeight = scrollHeight - scrollTop - scrollBottom;
    // Do nothing if populated nodes still fit the viewport.
    if (!force && scrollTop >= this._topPaddingHeight && scrollBottom >= this._bottomPaddingHeight)
      return;
    var hysteresisHeight = 500;
    scrollTop -= hysteresisHeight;
    viewPortHeight += 2 * hysteresisHeight;
    var selectedNode = this.selectedNode;
    this.rootNode().removeChildren();

    this._topPaddingHeight = 0;
    this._bottomPaddingHeight = 0;

    this._addVisibleNodes(this.rootNode(), scrollTop, scrollTop + viewPortHeight);

    this.setVerticalPadding(this._topPaddingHeight, this._bottomPaddingHeight);

    if (selectedNode) {
      // Keep selection even if the node is not in the current viewport.
      if (selectedNode.parent)
        selectedNode.select(true);
      else
        this.selectedNode = selectedNode;
    }
  }

  /**
   * @param {!WebInspector.DataGridNode} parentNode
   * @param {number} topBound
   * @param {number} bottomBound
   * @return {number}
   */
  _addVisibleNodes(parentNode, topBound, bottomBound) {
    if (!parentNode.expanded)
      return 0;

    var children = this.allChildren(parentNode);
    var topPadding = 0;
    var nameFilterValue = this._nameFilter ? this._nameFilter.value().toLowerCase() : '';
    // Iterate over invisible nodes beyond the upper bound of viewport.
    // Do not insert them into the grid, but count their total height.
    for (var i = 0; i < children.length; ++i) {
      var child = children[i];
      if (nameFilterValue && child.filteredOut && child.filteredOut(nameFilterValue))
        continue;
      var newTop = topPadding + this._nodeHeight(child);
      if (newTop > topBound)
        break;
      topPadding = newTop;
    }

    // Put visible nodes into the data grid.
    var position = topPadding;
    for (; i < children.length && position < bottomBound; ++i) {
      var child = children[i];
      if (nameFilterValue && child.filteredOut && child.filteredOut(nameFilterValue))
        continue;
      var hasChildren = child.hasChildren;
      child.removeChildren();
      child.hasChildren = hasChildren;
      child.revealed = true;
      parentNode.appendChild(child);
      position += child.nodeSelfHeight();
      position += this._addVisibleNodes(child, topBound - position, bottomBound - position);
    }

    // Count the invisible nodes beyond the bottom bound of the viewport.
    var bottomPadding = 0;
    for (; i < children.length; ++i) {
      var child = children[i];
      if (nameFilterValue && child.filteredOut && child.filteredOut(nameFilterValue))
        continue;
      bottomPadding += this._nodeHeight(child);
    }

    this._topPaddingHeight += topPadding;
    this._bottomPaddingHeight += bottomPadding;
    return position + bottomPadding;
  }

  /**
   * @param {!WebInspector.HeapSnapshotGridNode} node
   * @return {number}
   */
  _nodeHeight(node) {
    if (!node.revealed)
      return 0;
    var result = node.nodeSelfHeight();
    if (!node.expanded)
      return result;
    var children = this.allChildren(node);
    for (var i = 0; i < children.length; i++)
      result += this._nodeHeight(children[i]);
    return result;
  }

  /**
   * @param {!Array.<!WebInspector.HeapSnapshotGridNode>} pathToReveal
   * @return {!Promise.<!WebInspector.HeapSnapshotGridNode>}
   */
  revealTreeNode(pathToReveal) {
    var height = this._calculateOffset(pathToReveal);
    var node = /** @type {!WebInspector.HeapSnapshotGridNode} */ (pathToReveal.peekLast());
    var scrollTop = this.scrollContainer.scrollTop;
    var scrollBottom = scrollTop + this.scrollContainer.offsetHeight;
    if (height >= scrollTop && height < scrollBottom)
      return Promise.resolve(node);

    var scrollGap = 40;
    this.scrollContainer.scrollTop = Math.max(0, height - scrollGap);
    return new Promise(this._scrollTo.bind(this, node));
  }

  /**
   * @param {!WebInspector.HeapSnapshotGridNode} node
   * @param {function(!WebInspector.HeapSnapshotGridNode)} fulfill
   */
  _scrollTo(node, fulfill) {
    console.assert(!this._scrollToResolveCallback);
    this._scrollToResolveCallback = fulfill.bind(null, node);
  }

  /**
   * @param {!Array.<!WebInspector.HeapSnapshotGridNode>} pathToReveal
   * @return {number}
   */
  _calculateOffset(pathToReveal) {
    var parentNode = this.rootNode();
    var height = 0;
    for (var i = 0; i < pathToReveal.length; ++i) {
      var node = pathToReveal[i];
      var children = this.allChildren(parentNode);
      for (var j = 0; j < children.length; ++j) {
        var child = children[j];
        if (node === child) {
          height += node.nodeSelfHeight();
          break;
        }
        height += this._nodeHeight(child);
      }
      parentNode = node;
    }
    return height - pathToReveal.peekLast().nodeSelfHeight();
  }

  /**
   * @override
   * @param {!WebInspector.DataGridNode} parent
   * @return {!Array.<!WebInspector.HeapSnapshotGridNode>}
   */
  allChildren(parent) {
    return parent._allChildren || (parent._allChildren = []);
  }

  /**
   * @param {!WebInspector.DataGridNode} parent
   * @param {!WebInspector.HeapSnapshotGridNode} node
   */
  appendNode(parent, node) {
    this.allChildren(parent).push(node);
  }

  /**
   * @override
   * @param {!WebInspector.DataGridNode} parent
   * @param {!WebInspector.DataGridNode} node
   * @param {number} index
   */
  insertChild(parent, node, index) {
    this.allChildren(parent).splice(index, 0, /** @type {!WebInspector.HeapSnapshotGridNode} */ (node));
  }

  /**
   * @override
   */
  removeChildByIndex(parent, index) {
    this.allChildren(parent).splice(index, 1);
  }

  /**
   * @override
   */
  removeAllChildren(parent) {
    parent._allChildren = [];
  }

  removeTopLevelNodes() {
    this._disposeAllNodes();
    this.rootNode().removeChildren();
    this.rootNode()._allChildren = [];
  }

  /**
   * @param {!Element} element
   * @return {boolean}
   */
  _isScrolledIntoView(element) {
    var viewportTop = this.scrollContainer.scrollTop;
    var viewportBottom = viewportTop + this.scrollContainer.clientHeight;
    var elemTop = element.offsetTop;
    var elemBottom = elemTop + element.offsetHeight;
    return elemBottom <= viewportBottom && elemTop >= viewportTop;
  }

  /**
   * @override
   */
  onResize() {
    super.onResize();
    this.updateVisibleNodes(false);
  }

  _onScroll(event) {
    this.updateVisibleNodes(false);

    if (this._scrollToResolveCallback) {
      this._scrollToResolveCallback();
      this._scrollToResolveCallback = null;
    }
  }
};

/**
 * @unrestricted
 */
WebInspector.HeapSnapshotContainmentDataGrid = class extends WebInspector.HeapSnapshotSortableDataGrid {
  /**
   * @param {!WebInspector.ProfileType.DataDisplayDelegate} dataDisplayDelegate
   * @param {!Array.<!WebInspector.DataGrid.ColumnDescriptor>=} columns
   */
  constructor(dataDisplayDelegate, columns) {
    columns =
        columns || (/** @type {!Array<!WebInspector.DataGrid.ColumnDescriptor>} */ ([
          {id: 'object', title: WebInspector.UIString('Object'), disclosure: true, sortable: true},
          {id: 'distance', title: WebInspector.UIString('Distance'), width: '65px', sortable: true, fixedWidth: true}, {
            id: 'shallowSize',
            title: WebInspector.UIString('Shallow Size'),
            width: '105px',
            sortable: true,
            fixedWidth: true
          },
          {
            id: 'retainedSize',
            title: WebInspector.UIString('Retained Size'),
            width: '105px',
            sortable: true,
            fixedWidth: true,
            sort: WebInspector.DataGrid.Order.Descending
          }
        ]));
    super(dataDisplayDelegate, columns);
  }

  /**
   * @param {!WebInspector.HeapSnapshotProxy} snapshot
   * @param {number} nodeIndex
   */
  setDataSource(snapshot, nodeIndex) {
    this.snapshot = snapshot;
    var node = {nodeIndex: nodeIndex || snapshot.rootNodeIndex};
    var fakeEdge = {node: node};
    this.setRootNode(this._createRootNode(snapshot, fakeEdge));
    this.rootNode().sort();
  }

  _createRootNode(snapshot, fakeEdge) {
    return new WebInspector.HeapSnapshotObjectNode(this, snapshot, fakeEdge, null);
  }

  /**
   * @override
   */
  sortingChanged() {
    var rootNode = this.rootNode();
    if (rootNode.hasChildren)
      rootNode.sort();
  }
};

/**
 * @unrestricted
 */
WebInspector.HeapSnapshotRetainmentDataGrid = class extends WebInspector.HeapSnapshotContainmentDataGrid {
  /**
   * @param {!WebInspector.ProfileType.DataDisplayDelegate} dataDisplayDelegate
   */
  constructor(dataDisplayDelegate) {
    var columns = /** @type {!Array<!WebInspector.DataGrid.ColumnDescriptor>} */ ([
      {id: 'object', title: WebInspector.UIString('Object'), disclosure: true, sortable: true}, {
        id: 'distance',
        title: WebInspector.UIString('Distance'),
        width: '65px',
        sortable: true,
        fixedWidth: true,
        sort: WebInspector.DataGrid.Order.Ascending
      },
      {
        id: 'shallowSize',
        title: WebInspector.UIString('Shallow Size'),
        width: '105px',
        sortable: true,
        fixedWidth: true
      },
      {
        id: 'retainedSize',
        title: WebInspector.UIString('Retained Size'),
        width: '105px',
        sortable: true,
        fixedWidth: true
      }
    ]);
    super(dataDisplayDelegate, columns);
  }

  /**
   * @override
   */
  _createRootNode(snapshot, fakeEdge) {
    return new WebInspector.HeapSnapshotRetainingObjectNode(this, snapshot, fakeEdge, null);
  }

  _sortFields(sortColumn, sortAscending) {
    return {
      object: ['_name', sortAscending, '_count', false],
      count: ['_count', sortAscending, '_name', true],
      shallowSize: ['_shallowSize', sortAscending, '_name', true],
      retainedSize: ['_retainedSize', sortAscending, '_name', true],
      distance: ['_distance', sortAscending, '_name', true]
    }[sortColumn];
  }

  reset() {
    this.rootNode().removeChildren();
    this.resetSortingCache();
  }

  /**
   * @override
   * @param {!WebInspector.HeapSnapshotProxy} snapshot
   * @param {number} nodeIndex
   */
  setDataSource(snapshot, nodeIndex) {
    super.setDataSource(snapshot, nodeIndex);
    this.rootNode().expand();
  }
};

/** @enum {symbol} */
WebInspector.HeapSnapshotRetainmentDataGrid.Events = {
  ExpandRetainersComplete: Symbol('ExpandRetainersComplete')
};

/**
 * @unrestricted
 */
WebInspector.HeapSnapshotConstructorsDataGrid = class extends WebInspector.HeapSnapshotViewportDataGrid {
  /**
   * @param {!WebInspector.ProfileType.DataDisplayDelegate} dataDisplayDelegate
   */
  constructor(dataDisplayDelegate) {
    var columns = /** @type {!Array<!WebInspector.DataGrid.ColumnDescriptor>} */ ([
      {id: 'object', title: WebInspector.UIString('Constructor'), disclosure: true, sortable: true},
      {id: 'distance', title: WebInspector.UIString('Distance'), width: '65px', sortable: true, fixedWidth: true},
      {id: 'count', title: WebInspector.UIString('Objects Count'), width: '90px', sortable: true, fixedWidth: true}, {
        id: 'shallowSize',
        title: WebInspector.UIString('Shallow Size'),
        width: '105px',
        sortable: true,
        fixedWidth: true
      },
      {
        id: 'retainedSize',
        title: WebInspector.UIString('Retained Size'),
        width: '105px',
        sort: WebInspector.DataGrid.Order.Descending,
        sortable: true,
        fixedWidth: true
      }
    ]);
    super(dataDisplayDelegate, columns);
    this._profileIndex = -1;

    this._objectIdToSelect = null;
  }

  _sortFields(sortColumn, sortAscending) {
    return {
      object: ['_name', sortAscending, '_count', false],
      distance: ['_distance', sortAscending, '_retainedSize', true],
      count: ['_count', sortAscending, '_name', true],
      shallowSize: ['_shallowSize', sortAscending, '_name', true],
      retainedSize: ['_retainedSize', sortAscending, '_name', true]
    }[sortColumn];
  }

  /**
   * @override
   * @param {!HeapProfilerAgent.HeapSnapshotObjectId} id
   * @return {!Promise<?WebInspector.HeapSnapshotGridNode>}
   */
  revealObjectByHeapSnapshotId(id) {
    if (!this.snapshot) {
      this._objectIdToSelect = id;
      return Promise.resolve(/** @type {?WebInspector.HeapSnapshotGridNode} */ (null));
    }

    /**
     * @param {!Array<!WebInspector.HeapSnapshotGridNode>} nodes
     * @return {?Promise<!WebInspector.HeapSnapshotGridNode>}
     * @this {WebInspector.HeapSnapshotConstructorsDataGrid}
     */
    function didPopulateNode(nodes) {
      return nodes.length ? this.revealTreeNode(nodes) : null;
    }

    /**
     * @param {?string} className
     * @return {?Promise<?WebInspector.HeapSnapshotGridNode>}
     * @this {WebInspector.HeapSnapshotConstructorsDataGrid}
     */
    function didGetClassName(className) {
      if (!className)
        return null;
      var constructorNodes = this.topLevelNodes();
      for (var i = 0; i < constructorNodes.length; i++) {
        var parent = constructorNodes[i];
        if (parent._name === className)
          return parent.populateNodeBySnapshotObjectId(parseInt(id, 10)).then(didPopulateNode.bind(this));
      }
      // There are no visible top level nodes with such className.
      return null;
    }
    return this.snapshot.nodeClassName(parseInt(id, 10)).then(didGetClassName.bind(this));
  }

  clear() {
    this._nextRequestedFilter = null;
    this._lastFilter = null;
    this.removeTopLevelNodes();
  }

  /**
   * @param {!WebInspector.HeapSnapshotProxy} snapshot
   */
  setDataSource(snapshot) {
    this.snapshot = snapshot;
    if (this._profileIndex === -1)
      this._populateChildren();

    if (this._objectIdToSelect) {
      this.revealObjectByHeapSnapshotId(this._objectIdToSelect);
      this._objectIdToSelect = null;
    }
  }

  /**
   * @param {number} minNodeId
   * @param {number} maxNodeId
   */
  setSelectionRange(minNodeId, maxNodeId) {
    this._nodeFilter = new WebInspector.HeapSnapshotCommon.NodeFilter(minNodeId, maxNodeId);
    this._populateChildren(this._nodeFilter);
  }

  /**
   * @param {number} allocationNodeId
   */
  setAllocationNodeId(allocationNodeId) {
    this._nodeFilter = new WebInspector.HeapSnapshotCommon.NodeFilter();
    this._nodeFilter.allocationNodeId = allocationNodeId;
    this._populateChildren(this._nodeFilter);
  }

  /**
   * @param {!WebInspector.HeapSnapshotCommon.NodeFilter} nodeFilter
   * @param {!Object.<string, !WebInspector.HeapSnapshotCommon.Aggregate>} aggregates
   */
  _aggregatesReceived(nodeFilter, aggregates) {
    this._filterInProgress = null;
    if (this._nextRequestedFilter) {
      this.snapshot.aggregatesWithFilter(
          this._nextRequestedFilter, this._aggregatesReceived.bind(this, this._nextRequestedFilter));
      this._filterInProgress = this._nextRequestedFilter;
      this._nextRequestedFilter = null;
    }
    this.removeTopLevelNodes();
    this.resetSortingCache();
    for (var constructor in aggregates)
      this.appendNode(
          this.rootNode(),
          new WebInspector.HeapSnapshotConstructorNode(this, constructor, aggregates[constructor], nodeFilter));
    this.sortingChanged();
    this._lastFilter = nodeFilter;
  }

  /**
   * @param {!WebInspector.HeapSnapshotCommon.NodeFilter=} nodeFilter
   */
  _populateChildren(nodeFilter) {
    nodeFilter = nodeFilter || new WebInspector.HeapSnapshotCommon.NodeFilter();

    if (this._filterInProgress) {
      this._nextRequestedFilter = this._filterInProgress.equals(nodeFilter) ? null : nodeFilter;
      return;
    }
    if (this._lastFilter && this._lastFilter.equals(nodeFilter))
      return;
    this._filterInProgress = nodeFilter;
    this.snapshot.aggregatesWithFilter(nodeFilter, this._aggregatesReceived.bind(this, nodeFilter));
  }

  filterSelectIndexChanged(profiles, profileIndex) {
    this._profileIndex = profileIndex;
    this._nodeFilter = undefined;
    if (profileIndex !== -1) {
      var minNodeId = profileIndex > 0 ? profiles[profileIndex - 1].maxJSObjectId : 0;
      var maxNodeId = profiles[profileIndex].maxJSObjectId;
      this._nodeFilter = new WebInspector.HeapSnapshotCommon.NodeFilter(minNodeId, maxNodeId);
    }

    this._populateChildren(this._nodeFilter);
  }
};

/**
 * @unrestricted
 */
WebInspector.HeapSnapshotDiffDataGrid = class extends WebInspector.HeapSnapshotViewportDataGrid {
  /**
   * @param {!WebInspector.ProfileType.DataDisplayDelegate} dataDisplayDelegate
   */
  constructor(dataDisplayDelegate) {
    var columns = /** @type {!Array<!WebInspector.DataGrid.ColumnDescriptor>} */ ([
      {id: 'object', title: WebInspector.UIString('Constructor'), disclosure: true, sortable: true},
      {id: 'addedCount', title: WebInspector.UIString('# New'), width: '72px', sortable: true, fixedWidth: true},
      {id: 'removedCount', title: WebInspector.UIString('# Deleted'), width: '72px', sortable: true, fixedWidth: true},
      {id: 'countDelta', title: WebInspector.UIString('# Delta'), width: '64px', sortable: true, fixedWidth: true}, {
        id: 'addedSize',
        title: WebInspector.UIString('Alloc. Size'),
        width: '72px',
        sortable: true,
        fixedWidth: true,
        sort: WebInspector.DataGrid.Order.Descending
      },
      {id: 'removedSize', title: WebInspector.UIString('Freed Size'), width: '72px', sortable: true, fixedWidth: true},
      {id: 'sizeDelta', title: WebInspector.UIString('Size Delta'), width: '72px', sortable: true, fixedWidth: true}
    ]);
    super(dataDisplayDelegate, columns);
  }

  /**
   * @override
   * @return {number}
   */
  defaultPopulateCount() {
    return 50;
  }

  _sortFields(sortColumn, sortAscending) {
    return {
      object: ['_name', sortAscending, '_count', false],
      addedCount: ['_addedCount', sortAscending, '_name', true],
      removedCount: ['_removedCount', sortAscending, '_name', true],
      countDelta: ['_countDelta', sortAscending, '_name', true],
      addedSize: ['_addedSize', sortAscending, '_name', true],
      removedSize: ['_removedSize', sortAscending, '_name', true],
      sizeDelta: ['_sizeDelta', sortAscending, '_name', true]
    }[sortColumn];
  }

  setDataSource(snapshot) {
    this.snapshot = snapshot;
  }

  /**
   * @param {!WebInspector.HeapSnapshotProxy} baseSnapshot
   */
  setBaseDataSource(baseSnapshot) {
    this.baseSnapshot = baseSnapshot;
    this.removeTopLevelNodes();
    this.resetSortingCache();
    if (this.baseSnapshot === this.snapshot) {
      this.dispatchEventToListeners(WebInspector.HeapSnapshotSortableDataGrid.Events.SortingComplete);
      return;
    }
    this._populateChildren();
  }

  _populateChildren() {
    /**
     * @this {WebInspector.HeapSnapshotDiffDataGrid}
     */
    function aggregatesForDiffReceived(aggregatesForDiff) {
      this.snapshot.calculateSnapshotDiff(
          this.baseSnapshot.uid, aggregatesForDiff, didCalculateSnapshotDiff.bind(this));

      /**
       * @this {WebInspector.HeapSnapshotDiffDataGrid}
       */
      function didCalculateSnapshotDiff(diffByClassName) {
        for (var className in diffByClassName) {
          var diff = diffByClassName[className];
          this.appendNode(this.rootNode(), new WebInspector.HeapSnapshotDiffNode(this, className, diff));
        }
        this.sortingChanged();
      }
    }
    // Two snapshots live in different workers isolated from each other. That is why
    // we first need to collect information about the nodes in the first snapshot and
    // then pass it to the second snapshot to calclulate the diff.
    this.baseSnapshot.aggregatesForDiff(aggregatesForDiffReceived.bind(this));
  }
};

/**
 * @unrestricted
 */
WebInspector.AllocationDataGrid = class extends WebInspector.HeapSnapshotViewportDataGrid {
  /**
   * @param {?WebInspector.Target} target
   * @param {!WebInspector.ProfileType.DataDisplayDelegate} dataDisplayDelegate
   */
  constructor(target, dataDisplayDelegate) {
    var columns = /** @type {!Array<!WebInspector.DataGrid.ColumnDescriptor>} */ ([
      {id: 'liveCount', title: WebInspector.UIString('Live Count'), width: '72px', sortable: true, fixedWidth: true},
      {id: 'count', title: WebInspector.UIString('Count'), width: '60px', sortable: true, fixedWidth: true},
      {id: 'liveSize', title: WebInspector.UIString('Live Size'), width: '72px', sortable: true, fixedWidth: true},
      {
        id: 'size',
        title: WebInspector.UIString('Size'),
        width: '72px',
        sortable: true,
        fixedWidth: true,
        sort: WebInspector.DataGrid.Order.Descending
      },
      {id: 'name', title: WebInspector.UIString('Function'), disclosure: true, sortable: true},
    ]);
    super(dataDisplayDelegate, columns);
    this._target = target;
    this._linkifier = new WebInspector.Linkifier();
  }

  /**
   * @return {?WebInspector.Target}
   */
  target() {
    return this._target;
  }

  dispose() {
    this._linkifier.reset();
  }

  setDataSource(snapshot) {
    this.snapshot = snapshot;
    this.snapshot.allocationTracesTops(didReceiveAllocationTracesTops.bind(this));

    /**
     * @param {!Array.<!WebInspector.HeapSnapshotCommon.SerializedAllocationNode>} tops
     * @this {WebInspector.AllocationDataGrid}
     */
    function didReceiveAllocationTracesTops(tops) {
      this._topNodes = tops;
      this._populateChildren();
    }
  }

  _populateChildren() {
    this.removeTopLevelNodes();
    var root = this.rootNode();
    var tops = this._topNodes;
    for (var i = 0; i < tops.length; i++)
      this.appendNode(root, new WebInspector.AllocationGridNode(this, tops[i]));
    this.updateVisibleNodes(true);
  }

  /**
   * @override
   */
  sortingChanged() {
    this._topNodes.sort(this._createComparator());
    this.rootNode().removeChildren();
    this._populateChildren();
  }

  /**
   * @return {function(!Object, !Object):number}
   */
  _createComparator() {
    var fieldName = this.sortColumnId();
    var compareResult = (this.sortOrder() === WebInspector.DataGrid.Order.Ascending) ? +1 : -1;
    /**
     * @param {!Object} a
     * @param {!Object} b
     * @return {number}
     */
    function compare(a, b) {
      if (a[fieldName] > b[fieldName])
        return compareResult;
      if (a[fieldName] < b[fieldName])
        return -compareResult;
      return 0;
    }
    return compare;
  }
};