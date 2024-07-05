import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PipeTransform,
  SimpleChanges,
  TemplateRef,
  ViewChild
} from '@angular/core';

import {
  getterForProp,
  SortDirection,
  SortPropDir,
  TableColumnProp
} from '@swimlane/ngx-datatable';
import { TableHeaderItem, TableItem, TableModel } from 'carbon-components-angular';
import _ from 'lodash';
import { Observable, of, Subject, Subscription } from 'rxjs';

import { TableStatus } from '~/app/shared/classes/table-status';
import { CellTemplate } from '~/app/shared/enum/cell-template.enum';
import { Icons } from '~/app/shared/enum/icons.enum';
import { CdTableColumn } from '~/app/shared/models/cd-table-column';
import { CdTableColumnFilter } from '~/app/shared/models/cd-table-column-filter';
import { CdTableColumnFiltersChange } from '~/app/shared/models/cd-table-column-filters-change';
import { CdTableFetchDataContext } from '~/app/shared/models/cd-table-fetch-data-context';
import { PageInfo } from '~/app/shared/models/cd-table-paging';
import { CdTableSelection } from '~/app/shared/models/cd-table-selection';
import { CdUserConfig } from '~/app/shared/models/cd-user-config';
import { TimerService } from '~/app/shared/services/timer.service';

const TABLE_LIST_LIMIT = 10;
@Component({
  selector: 'cd-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableComponent implements AfterViewInit, OnInit, OnChanges, OnDestroy {
  @ViewChild('tableCellBoldTpl', { static: true })
  tableCellBoldTpl: TemplateRef<any>;
  @ViewChild('sparklineTpl', { static: true })
  sparklineTpl: TemplateRef<any>;
  @ViewChild('routerLinkTpl', { static: true })
  routerLinkTpl: TemplateRef<any>;
  @ViewChild('checkIconTpl', { static: true })
  checkIconTpl: TemplateRef<any>;
  @ViewChild('perSecondTpl', { static: true })
  perSecondTpl: TemplateRef<any>;
  @ViewChild('executingTpl', { static: true })
  executingTpl: TemplateRef<any>;
  @ViewChild('classAddingTpl', { static: true })
  classAddingTpl: TemplateRef<any>;
  @ViewChild('badgeTpl', { static: true })
  badgeTpl: TemplateRef<any>;
  @ViewChild('mapTpl', { static: true })
  mapTpl: TemplateRef<any>;
  @ViewChild('truncateTpl', { static: true })
  truncateTpl: TemplateRef<any>;
  @ViewChild('timeAgoTpl', { static: true })
  timeAgoTpl: TemplateRef<any>;
  @ViewChild('rowDetailsTpl', { static: true })
  rowDetailsTpl: TemplateRef<any>;
  @ViewChild('rowSelectionTpl', { static: true })
  rowSelectionTpl: TemplateRef<any>;
  @ViewChild('pathTpl', { static: true })
  pathTpl: TemplateRef<any>;
  @ViewChild('tooltipTpl', { static: true })
  tooltipTpl: TemplateRef<any>;
@ViewChild('copyTpl', { static: true })
  copyTpl: TemplateRef<any>;
  @ViewChild('defaultValueTpl', { static: true })
  defaultValueTpl: TemplateRef<any>;
  @ViewChild('rowDetailTpl', { static: true })
  rowDetailTpl: TemplateRef<any>;

  @ContentChild(TemplateRef) template!: TemplateRef<any>;

  // This is the array with the items to be shown.
  @Input()
  data: any[];
  // Each item -> { prop: 'attribute name', name: 'display name' }
  @Input()
  columns: CdTableColumn[];
  // Each item -> { prop: 'attribute name', dir: 'asc'||'desc'}
  @Input()
  sorts?: SortPropDir[];
  // Method used for setting column widths.
  @Input()
  columnMode? = 'flex';
  // Display only actions in header (make sure to disable toolHeader) and use ".only-table-actions"
  @Input()
  onlyActionHeader? = false;
  // Display the tool header, including reload button, pagination and search fields?
  @Input()
  toolHeader? = true;
  // Display search field inside tool header?
  @Input()
  searchField? = true;
  // Display the table header?
  @Input()
  header? = true;
  // Display the table footer?
  @Input()
  footer? = true;
  // Page size to show. Set to 0 to show unlimited number of rows.
  @Input()
  limit? = TABLE_LIST_LIMIT;
  @Input()
  maxLimit? = 9999;
  // Has the row details?
  @Input()
  hasDetails = false;

  /**
   * Auto reload time in ms - per default every 5s
   * You can set it to 0, undefined or false to disable the auto reload feature in order to
   * trigger 'fetchData' if the reload button is clicked.
   * You can set it to a negative number to, on top of disabling the auto reload,
   * prevent triggering fetchData when initializing the table.
   */
  @Input()
  autoReload = 5000;

  // Which row property is unique for a row. If the identifier is not specified in any
  // column, then the property name of the first column is used. Defaults to 'id'.
  @Input()
  identifier = 'id';
  // If 'true', then the specified identifier is used anyway, although it is not specified
  // in any column. Defaults to 'false'.
  @Input()
  forceIdentifier = false;
  // Allows other components to specify which type of selection they want,
  // e.g. 'single' or 'multi'.
  @Input()
  selectionType: string = undefined;
  // By default selected item details will be updated on table refresh, if data has changed
  @Input()
  updateSelectionOnRefresh: 'always' | 'never' | 'onChange' = 'onChange';
  // By default expanded item details will be updated on table refresh, if data has changed
  @Input()
  updateExpandedOnRefresh: 'always' | 'never' | 'onChange' = 'onChange';

  @Input()
  autoSave = true;

  // Enable this in order to search through the JSON of any used object.
  @Input()
  searchableObjects = false;

  // Only needed to set if the classAddingTpl is used
  @Input()
  customCss?: { [css: string]: number | string | ((any: any) => boolean) };

  // Columns that aren't displayed but can be used as filters
  @Input()
  extraFilterableColumns: CdTableColumn[] = [];

  @Input()
  status = new TableStatus();

  // Support server-side pagination/sorting/etc.
  @Input()
  serverSide = false;

  /*
  Only required when serverSide is enabled.
  It should be provided by the server via "X-Total-Count" HTTP Header
  */
  @Input()
  count = 0;

  /**
   * Should be a function to update the input data if undefined nothing will be triggered
   *
   * Sometimes it's useful to only define fetchData once.
   * Example:
   * Usage of multiple tables with data which is updated by the same function
   * What happens:
   * The function is triggered through one table and all tables will update
   */
  @Output()
  fetchData = new EventEmitter<CdTableFetchDataContext>();

  /**
   * This should be defined if you need access to the selection object.
   *
   * Each time the table selection changes, this will be triggered and
   * the new selection object will be sent.
   *
   * @memberof TableComponent
   */
  @Output()
  updateSelection = new EventEmitter();

  @Output()
  setExpandedRow = new EventEmitter();

  /**
   * This should be defined if you need access to the applied column filters.
   *
   * Each time the column filters changes, this will be triggered and
   * the column filters change event will be sent.
   *
   * @memberof TableComponent
   */
  @Output() columnFiltersChanged = new EventEmitter<CdTableColumnFiltersChange>();

  /**
   * Use this variable to access the selected row(s).
   */
  selection = new CdTableSelection();

  /**
   * Use this variable to access the expanded row
   */
  expanded: any = undefined;

  /**
   * To prevent making changes to the original columns list, that might change
   * how the table is renderer a second time, we now clone that list into a
   * local variable and only use the clone.
   */
  localColumns: CdTableColumn[];

  model: TableModel = new TableModel();

  set tableColumns(value: CdTableColumn[]) {
    this._tableColumns = value;
    this.model.header = value.map(
      (col: CdTableColumn) =>
        new TableHeaderItem({
          data: col.name,
          title: col.name,
          visible: !col.isHidden || !col.isInvisible
        })
    );
  }

  get tableColumns() {
    return this._tableColumns;
  }

  private _tableColumns: CdTableColumn[];

  icons = Icons;
  cellTemplates: {
    [key: string]: TemplateRef<any>;
  } = {};
  search = '';

  set rows(value: any[]) {
    this._rows = value;
    this.doPagination({
      page: this.model.currentPage,
      size: this.model.pageLength,
      filteredData: value
    });
    this.model.totalDataLength = value.length;
  }

  get rows() {
    return this._rows;
  }

  private _rows: any[] = [];

  private _dataset = new BehaviorSubject<any[]>([]);

  private _subscriptions: Subscription = new Subscription();

  loadingIndicator = true;

  // TODO: Investigate how this is being used and then removed it completely
  paginationClasses = {
    pagerLeftArrow: Icons.leftArrowDouble,
    pagerRightArrow: Icons.rightArrowDouble,
    pagerPrevious: Icons.leftArrow,
    pagerNext: Icons.rightArrow
  };
  // TODO: Need to modify CdUserConfig so it doesn't depend on ngx-datatable anymore
  userConfig: CdUserConfig = {};
  tableName: string;
  localStorage = window.localStorage;
  private saveSubscriber: Subscription;
  private reloadSubscriber: Subscription;
  private updating = false;

  columnFilters: CdTableColumnFilter[] = [];
  selectedFilter: CdTableColumnFilter;
  get columnFiltered(): boolean {
    return _.some(this.columnFilters, (filter) => {
      return filter.value !== undefined;
    });
  }

  constructor(
    // private ngZone: NgZone,
    private cdRef: ChangeDetectorRef,
    private timerService: TimerService
  ) {}

  static prepareSearch(search: string) {
    search = search.toLowerCase().replace(/,/g, '');
    if (search.match(/['"][^'"]+['"]/)) {
      search = search.replace(/['"][^'"]+['"]/g, (match: string) => {
        return match.replace(/(['"])([^'"]+)(['"])/g, '$2').replace(/ /g, '+');
      });
    }
    return search.split(' ').filter((word) => word);
  }

  ngAfterViewInit(): void {
    const datasetSubscription = this._dataset.subscribe({
      next: (values: any[]) => {
        if (!values?.length) return;

        const columnProps = this.tableColumns.filter((x) => !x.isHidden || !x.isInvisible);

        let datasets: TableItem[][] = [];

        values.forEach((val) => {
          let dataset: TableItem[] = [];

          columnProps.forEach((column: CdTableColumn, i: number) => {
            const value = _.get(val, column.prop);

            if (!_.isNil(value)) {
              let tableItem = new TableItem({
                selected: val,
                data: { value, row: val, column }
              });

              if (i === 0) {
                tableItem.data = { ...tableItem.data, row: val };

                if (this.hasDetails) {
                  (tableItem.expandedData = val), (tableItem.expandedTemplate = this.rowDetailTpl);
                }
              }

              tableItem.template = column.cellTemplate || this.defaultValueTpl;

              dataset.push(tableItem);
            }
          });

          datasets.push(dataset);
        });
        if (!_.isEqual(this.model.data, datasets)) {
          this.model.data = datasets;
        }
      }
    });

    this._subscriptions.add(datasetSubscription);
  }

  ngOnInit() {
    this.localColumns = _.clone(this.columns);
    // debounce reloadData method so that search doesn't run api requests
    // for every keystroke
    if (this.serverSide) {
      this.reloadData = _.debounce(this.reloadData, 1000);
    }

    // ngx-datatable triggers calculations each time mouse enters a row,
    // this will prevent that.
    // this.table.element.addEventListener('mouseenter', (e) => e.stopPropagation());
    this._addTemplates();
    if (!this.sorts) {
      // Check whether the specified identifier exists.
      const exists = _.findIndex(this.localColumns, ['prop', this.identifier]) !== -1;
      // Auto-build the sorting configuration. If the specified identifier doesn't exist,
      // then use the property of the first column.
      this.sorts = this.createSortingDefinition(
        exists ? this.identifier : this.localColumns[0].prop + ''
      );
      // If the specified identifier doesn't exist and it is not forced to use it anyway,
      // then use the property of the first column.
      if (!exists && !this.forceIdentifier) {
        this.identifier = this.localColumns[0].prop + '';
      }
    }

    this.initUserConfig();
    this.localColumns.forEach((c) => {
      if (c.cellTransformation) {
        c.cellTemplate = this.cellTemplates[c.cellTransformation];
      }
      if (!c.flexGrow) {
        c.flexGrow = c.prop + '' === this.identifier ? 1 : 2;
      }
      if (!c.resizeable) {
        c.resizeable = false;
      }
    });

    this.filterHiddenColumns();
    this.initColumnFilters();
    this.updateColumnFilterOptions();
    // Notify all subscribers to reset their current selection.
    this.updateSelection.emit(new CdTableSelection());
    // Load the data table content every N ms or at least once.
    // Force showing the loading indicator if there are subscribers to the fetchData
    // event. This is necessary because it has been set to False in useData() when
    // this method was triggered by ngOnChanges().
    if (this.fetchData.observers.length > 0) {
      this.loadingIndicator = true;
    }
    if (_.isInteger(this.autoReload) && this.autoReload > 0) {
      this.reloadSubscriber = this.timerService
        .get(() => of(0), this.autoReload)
        .subscribe(() => {
          this.reloadData();
        });
    } else if (!this.autoReload) {
      this.reloadData();
    } else {
      this.useData();
    }
  }
  // TODO: Understand what this does
  initUserConfig() {
    if (this.autoSave) {
      this.tableName = this._calculateUniqueTableName(this.localColumns);
      this._loadUserConfig();
      this._initUserConfigAutoSave();
    }
    if (this.limit !== TABLE_LIST_LIMIT || !this.userConfig.limit) {
      this.userConfig.limit = this.limit;
    }
    if (!(this.userConfig.offset >= 0)) {
      // TODO: How to replace this? What does it do?
      // this.userConfig.offset = this.table.offset;
    }
    if (!this.userConfig.search) {
      this.userConfig.search = this.search;
    }
    if (!this.userConfig.sorts) {
      this.userConfig.sorts = this.sorts;
    }
    if (!this.userConfig.columns) {
      this.updateUserColumns();
    } else {
      this.userConfig.columns.forEach((col) => {
        for (let i = 0; i < this.localColumns.length; i++) {
          if (this.localColumns[i].prop === col.prop) {
            this.localColumns[i].isHidden = col.isHidden;
          }
        }
      });
    }
  }

  _calculateUniqueTableName(columns: any[]) {
    const stringToNumber = (s: string) => {
      if (!_.isString(s)) {
        return 0;
      }
      let result = 0;
      for (let i = 0; i < s.length; i++) {
        result += s.charCodeAt(i) * i;
      }
      return result;
    };
    return columns
      .reduce(
        (result, value, index) =>
          (stringToNumber(value.prop) + stringToNumber(value.name)) * (index + 1) + result,
        0
      )
      .toString();
  }

  _loadUserConfig() {
    const loaded = this.localStorage.getItem(this.tableName);
    if (loaded) {
      this.userConfig = JSON.parse(loaded);
    }
  }

  _initUserConfigAutoSave() {
    const source: Observable<any> = new Observable(this._initUserConfigProxy.bind(this));
    this.saveSubscriber = source.subscribe(this._saveUserConfig.bind(this));
  }

  _initUserConfigProxy(observer: Subject<any>) {
    this.userConfig = new Proxy(this.userConfig, {
      set(config, prop: string, value) {
        config[prop] = value;
        observer.next(config);
        return true;
      }
    });
  }

  _saveUserConfig(config: any) {
    this.localStorage.setItem(this.tableName, JSON.stringify(config));
  }
  // TODO: What does userConfig.columns do and why does it need to be updated?
  updateUserColumns() {
    this.userConfig.columns = this.localColumns.map((c) => ({
      prop: c.prop,
      name: c.name,
      isHidden: !!c.isHidden
    }));
  }

  filterHiddenColumns() {
    this.tableColumns = this.localColumns.filter((c) => !c.isHidden);
  }

  initColumnFilters() {
    let filterableColumns = _.filter(this.localColumns, { filterable: true });
    filterableColumns = [...filterableColumns, ...this.extraFilterableColumns];
    this.columnFilters = filterableColumns.map((col: CdTableColumn) => {
      return {
        column: col,
        options: [],
        value: col.filterInitValue
          ? this.createColumnFilterOption(col.filterInitValue, col.pipe)
          : undefined
      };
    });
    this.selectedFilter = _.first(this.columnFilters);
  }

  private createColumnFilterOption(
    value: any,
    pipe?: PipeTransform
  ): { raw: string; formatted: string } {
    return {
      raw: _.toString(value),
      formatted: pipe ? pipe.transform(value) : _.toString(value)
    };
  }

  updateColumnFilterOptions() {
    // update all possible values in a column
    this.columnFilters.forEach((filter) => {
      let values: any[] = [];

      if (_.isUndefined(filter.column.filterOptions)) {
        // only allow types that can be easily converted into string
        const pre = _.filter(_.map(this.data, filter.column.prop), (v) => {
          return (_.isString(v) && v !== '') || _.isBoolean(v) || _.isFinite(v) || _.isDate(v);
        });
        values = _.sortedUniq(pre.sort());
      } else {
        values = filter.column.filterOptions;
      }

      const options = values.map((v) => this.createColumnFilterOption(v, filter.column.pipe));

      // In case a previous value is not available anymore
      if (filter.value && _.isUndefined(_.find(options, { raw: filter.value.raw }))) {
        filter.value = undefined;
      }

      filter.options = options;
    });
  }

  onSelectFilter(filter: string) {
    const value = this.columnFilters.find((x) => x.column.name === filter);
    this.selectedFilter = value;
  }

  onChangeFilter(filter: string) {
    const option = this.selectedFilter.options.find((x) => x.raw === filter);
    this.selectedFilter.value = _.isEqual(this.selectedFilter.value, option) ? undefined : option;
    this.updateFilter();
  }

  doColumnFiltering() {
    const appliedFilters: CdTableColumnFiltersChange['filters'] = [];
    let data = [...this.data];
    let dataOut: any[] = [];
    this.columnFilters.forEach((filter) => {
      if (filter.value === undefined) {
        return;
      }
      appliedFilters.push({
        name: filter.column.name,
        prop: filter.column.prop,
        value: filter.value
      });
      // Separate data to filtered and filtered-out parts.
      const parts = _.partition(data, (row) => {
        // Use getter from ngx-datatable to handle props like 'sys_api.size'
        const valueGetter = getterForProp(filter.column.prop);
        const value = valueGetter(row, filter.column.prop);
        if (_.isUndefined(filter.column.filterPredicate)) {
          // By default, test string equal
          return `${value}` === filter.value.raw;
        } else {
          // Use custom function to filter
          return filter.column.filterPredicate(row, filter.value.raw);
        }
      });
      data = parts[0];
      dataOut = [...dataOut, ...parts[1]];
    });

    this.columnFiltersChanged.emit({
      filters: appliedFilters,
      data: data,
      dataOut: dataOut
    });

    // Remove the selection if previously-selected rows are filtered out.
    _.forEach(this.selection.selected, (selectedItem) => {
      if (_.find(data, { [this.identifier]: selectedItem[this.identifier] }) === undefined) {
        this.selection = new CdTableSelection();
        this.onSelect(this.selection);
      }
    });
    return data;
  }

  ngOnDestroy() {
    if (this.reloadSubscriber) {
      this.reloadSubscriber.unsubscribe();
    }
    if (this.saveSubscriber) {
      this.saveSubscriber.unsubscribe();
    }
    this._subscriptions.unsubscribe();
  }

  _addTemplates() {
    this.cellTemplates.bold = this.tableCellBoldTpl;
    this.cellTemplates.checkIcon = this.checkIconTpl;
    this.cellTemplates.sparkline = this.sparklineTpl;
    this.cellTemplates.routerLink = this.routerLinkTpl;
    this.cellTemplates.perSecond = this.perSecondTpl;
    this.cellTemplates.executing = this.executingTpl;
    this.cellTemplates.classAdding = this.classAddingTpl;
    this.cellTemplates.badge = this.badgeTpl;
    this.cellTemplates.map = this.mapTpl;
    this.cellTemplates.truncate = this.truncateTpl;
    this.cellTemplates.timeAgo = this.timeAgoTpl;
    this.cellTemplates.path = this.pathTpl;
    this.cellTemplates.tooltip = this.tooltipTpl;
    this.cellTemplates.copy = this.copyTpl;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes?.data?.currentValue) {
      this.useData();
    }
  }

  setLimit(e: any) {
    const value = Number(e.target.value);
    if (value > 0) {
      if (this.maxLimit && value > this.maxLimit) {
        this.userConfig.limit = this.maxLimit;
        // change input field to maxLimit
        e.srcElement.value = this.maxLimit;
      } else {
        this.userConfig.limit = value;
      }
    }
    if (this.serverSide) {
      this.reloadData();
    }
  }

  reloadData() {
    if (!this.updating) {
      this.status = new TableStatus();
      const context = new CdTableFetchDataContext(() => {
        // Do we have to display the error panel?
        if (!!context.errorConfig.displayError) {
          this.status = new TableStatus('danger', $localize`Failed to load data.`);
        }
        // Force data table to show no data?
        if (context.errorConfig.resetData) {
          this.data = [];
        }
        // Stop the loading indicator and reset the data table
        // to the correct state.
        this.useData();
      });
      context.pageInfo.offset = this.userConfig.offset;
      context.pageInfo.limit = this.userConfig.limit;
      context.search = this.userConfig.search;
      if (this.userConfig.sorts?.length) {
        const sort = this.userConfig.sorts[0];
        context.sort = `${sort.dir === 'desc' ? '-' : '+'}${sort.prop}`;
      }
      this.fetchData.emit(context);
      this.updating = true;
    }
  }

  refreshBtn() {
    this.loadingIndicator = true;
    this.reloadData();
  }

  changePage(pageInfo: PageInfo) {
    this.userConfig.offset = pageInfo.offset;
    this.userConfig.limit = pageInfo.limit;
    if (this.serverSide) {
      this.reloadData();
    }
  }

  onPageChange(page: number) {
    this.model.currentPage = page;
    this.doPagination({});
  }

  doPagination({
    page = this.model.currentPage,
    size = this.model.pageLength,
    filteredData = this.rows
  }): void {
    let start = page;
    let end = size;

    if (start <= 1) {
      start = 0;
      end = size;
    } else {
      start = (start - 1) * size;
      end = page * size;
      if (end > filteredData.length) {
        end = filteredData.length;
      }
    }

    const paginated = filteredData?.slice?.(start, end);

    this._dataset.next(paginated);
  }

  rowIdentity() {
    return (row: any) => {
      const id = row[this.identifier];
      if (_.isUndefined(id)) {
        throw new Error(`Wrong identifier "${this.identifier}" -> "${id}"`);
      }
      return id;
    };
  }

  useData() {
    if (!this.data) {
      return; // Wait for data
    }
    this.updateColumnFilterOptions();
    this.updateFilter();
    this.reset();
    this.updateSelected();
    this.updateExpanded();
    this.toggleExpandedRow();
    this.doSorting();
  }

  /**
   * Reset the data table to correct state. This includes:
   * - Disable loading indicator
   * - Reset 'Updating' flag
   */
  reset() {
    this.loadingIndicator = false;
    this.updating = false;
  }

  /**
   * After updating the data, we have to update the selected items
   * because details may have changed,
   * or some selected items may have been removed.
   */
  updateSelected() {
    // TODO: Update this method to work with new data struture
    if (this.updateSelectionOnRefresh === 'never') {
      return;
    }
    if (!this.selection?.selected?.length) return;

    const newSelected = new Set();
    this.selection.selected.forEach((selectedItem) => {
      for (const row of this.data) {
        if (selectedItem[this.identifier] === row[this.identifier]) {
          // TODO: Create method that creates individual TableItem obj based on raw data
          newSelected.add(row);
        }
      }
    });
    if (newSelected.size === 0) return;
    const newSelectedArray = Array.from(newSelected.values());
    if (
      this.updateSelectionOnRefresh === 'onChange' &&
      _.isEqual(this.selection.selected, newSelectedArray)
    ) {
      return;
    }
    this.selection.selected = newSelectedArray;
    this.onSelect(this.selection);
  }

  updateExpanded() {
    if (_.isUndefined(this.expanded) || this.updateExpandedOnRefresh === 'never') {
      return;
    }

    const expandedId = this.expanded[this.identifier];
    const newExpanded = _.find(this.data, (row) => expandedId === row[this.identifier]);

    if (this.updateExpandedOnRefresh === 'onChange' && _.isEqual(this.expanded, newExpanded)) {
      return;
    }

    this.expanded = newExpanded;
    this.setExpandedRow.emit(newExpanded);
  }

  private toggleExpandedRow() {
    const rowId = this.model.data.findIndex((row: TableItem[]) => {
      const rowSelectedId = _.get(row, [0, 'selected', this.identifier]);
      const expandedId = this.expanded?.[this.identifier];
      return _.isEqual(rowSelectedId, expandedId);
    });

    this.model.rowsIndices.forEach((i: number) => {
      if (i === rowId) this.model.expandRow(i, true);
      else this.model.expandRow(i, false);
    });

    this.setExpandedRow.emit(this.expanded);
  }

  onSelect($event: any) {
    const { selectedRowIndex } = $event;
    // TODO: Fix row selection to work with new data structure
    if (!_.isNil(selectedRowIndex)) {
      const selectedData = _.get(this.model.data?.[selectedRowIndex], [0, 'selected']);
      this.selection.selected = [selectedData];
    } else if (!_.isNil($event)) {
      this.selection = $event;
    }
    const clonedSelection = _.clone(this.selection);
    this.expanded = clonedSelection?.selected?.[0];
    this.updateSelection.emit(clonedSelection);

    this.toggleExpandedRow();
  }

  onDeselect($event: any) {
    const { deselectedRowIndex } = $event;
    this.selection.selected = [];
    this.expanded = undefined;
    this.model.expandRow(deselectedRowIndex, false);
  }

  toggleColumn(column: CdTableColumn) {
    // TODO: Understand what this mean and modify appropriately
    // const prop: TableColumnProp = column.prop;
    // const hide = !column.isHidden;
    // if (hide && this.tableColumns.length === 1) {
    //   column.isHidden = true;
    //   return;
    // }
    // _.find(this.localColumns, (c: CdTableColumn) => c.prop === prop).isHidden = hide;
    // this.updateColumns();
    this.model.header.forEach((col) => {
      const shouldHide = !col.visible;
      if (column.data === col.data) {
        col.visible = shouldHide;
      }
    });
  }

  updateColumns() {
    this.updateUserColumns();
    this.filterHiddenColumns();
    const sortProp = this.userConfig.sorts[0].prop;
    if (!_.find(this.tableColumns, (c: CdTableColumn) => c.prop === sortProp)) {
      this.userConfig.sorts = this.createSortingDefinition(this.tableColumns[0].prop);
    }
    // TODO: How to replace this? What does it do?
    // this.table.recalculate();
    this.cdRef.detectChanges();
  }

  createSortingDefinition(prop: TableColumnProp): SortPropDir[] {
    return [
      {
        prop: prop,
        dir: SortDirection.asc
      }
    ];
  }

  changeSorting(columnIndex: number) {
    const prop = this.tableColumns?.[columnIndex]?.prop;

    if (this.model.header[columnIndex].sorted) {
      this.model.header[columnIndex].descending = this.model.header[columnIndex].ascending;
    } else {
      const configDir = this.userConfig?.sorts?.find?.((x) => x.prop === prop)?.dir;
      this.model.header[columnIndex].ascending = configDir === 'asc';
      this.model.header[columnIndex].descending = configDir === 'desc';
    }

    const dir = this.model.header[columnIndex].ascending ? SortDirection.asc : SortDirection.desc;
    const sorts = [{ dir, prop }];

    this.userConfig.sorts = sorts;
    if (this.serverSide) {
      this.userConfig.offset = 0;
      this.reloadData();
    }

    this.doSorting(columnIndex);
  }

  doSorting(columnIndex?: number) {
    const index =
      columnIndex ||
      this.tableColumns?.findIndex?.((x) => x.prop === this.userConfig?.sorts?.[0]?.prop);

    if (_.isNil(index) || index < 0) return;

    const prop = this.tableColumns?.[index]?.prop;

    const configDir = this.userConfig?.sorts?.find?.((x) => x.prop === prop)?.dir;
    this.model.header[index].ascending = configDir === 'asc';
    this.model.header[index].descending = configDir === 'desc';

    const tmp = this.rows.slice();

    tmp.sort((a, b) => {
      const rowA = _.get(a, prop);
      const rowB = _.get(b, prop);
      if (rowA > rowB) {
        return this.model.header[index].descending ? -1 : 1;
      }
      if (rowB > rowA) {
        return this.model.header[index].descending ? 1 : -1;
      }
      return 0;
    });

    this.model.header[index].sorted = true;
    this.rows = tmp.slice();
  }

  onClearSearch() {
    this.search = '';
    this.updateFilter();
  }

  onClearFilters() {
    this.columnFilters.forEach((filter) => {
      filter.value = undefined;
    });
    this.selectedFilter = _.first(this.columnFilters);
    this.updateFilter();
  }

  updateFilter() {
    if (this.serverSide) {
      if (this.userConfig.search !== this.search) {
        // if we don't go back to the first page it will try load
        // a page which could not exists with an especific search
        this.userConfig.offset = 0;
        this.userConfig.limit = this.limit;
        this.userConfig.search = this.search;
        this.updating = false;
        this.reloadData();
      }
      this.rows = this.data;
    } else {
      let rows = this.columnFilters.length !== 0 ? this.doColumnFiltering() : this.data;

      if (this.search.length > 0 && rows?.length) {
        const columns = this.localColumns.filter(
          (c) => c.cellTransformation !== CellTemplate.sparkline
        );
        // update the rows
        rows = this.subSearch(rows, TableComponent.prepareSearch(this.search), columns);
        // Whenever the filter changes, always go back to the first page
        // TODO: Understand how this works and change appropriately
        // this.table.offset = 0;
      }

      if (this.columnFilters.length !== 0) {
        const cols = this.localColumns?.filter?.((x) => rows?.[0]?.hasOwnProperty(x.prop));
        if (cols?.length) this.tableColumns = cols;
      }

      this.rows = rows;
    }
  }

  subSearch(data: any[], currentSearch: string[], columns: CdTableColumn[]): any[] {
    if (currentSearch.length === 0 || data.length === 0) {
      return data;
    }
    const searchTerms: string[] = currentSearch.pop().replace(/\+/g, ' ').split(':');
    const columnsClone = [...columns];
    if (searchTerms.length === 2) {
      columns = columnsClone.filter((c) => c.name.toLowerCase().indexOf(searchTerms[0]) !== -1);
    }
    data = this.basicDataSearch(_.last(searchTerms), data, columns);
    // Checks if user searches for column but he is still typing
    return this.subSearch(data, currentSearch, columnsClone);
  }

  basicDataSearch(searchTerm: string, rows: any[], columns: CdTableColumn[]) {
    if (searchTerm.length === 0) {
      return rows;
    }
    return rows.filter((row) => {
      return (
        columns.filter((col) => {
          let cellValue: any = _.get(row, col.prop);

          if (!_.isUndefined(col.pipe)) {
            cellValue = col.pipe.transform(cellValue);
          }
          if (_.isUndefined(cellValue) || _.isNull(cellValue)) {
            return false;
          }

          if (_.isObjectLike(cellValue)) {
            if (this.searchableObjects) {
              cellValue = JSON.stringify(cellValue);
            } else {
              return false;
            }
          }

          if (_.isArray(cellValue)) {
            cellValue = cellValue.join(' ');
          } else if (_.isNumber(cellValue) || _.isBoolean(cellValue)) {
            cellValue = cellValue.toString();
          }

          return cellValue.toLowerCase().indexOf(searchTerm) !== -1;
        }).length > 0
      );
    });
  }

  getRowClass() {
    // Return the function used to populate a row's CSS classes.
    return () => {
      return {
        clickable: !_.isUndefined(this.selectionType)
      };
    };
  }
  // TODO: This method doesn't make sense with the new data table. Remove
  toggleExpandRow(row: any, isExpanded: boolean, event: any) {
    event.stopPropagation();
    if (!isExpanded) {
      // If current row isn't expanded, collapse others
      this.expanded = row;
      // TODO: How to replace this? What does it do?
      // this.table.rowDetail.collapseAllRows();
      this.setExpandedRow.emit(row);
    } else {
      // If all rows are closed, emit undefined
      this.expanded = undefined;
      this.setExpandedRow.emit(undefined);
    }
    // TODO: How to replace this? What does it do?
    // this.table.rowDetail.toggleExpandRow(row);
  }
}
