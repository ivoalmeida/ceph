import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TableItem, TableModel } from 'carbon-components-angular';
import { CdTableFetchDataContext } from '../../models/cd-table-fetch-data-context';

@Component({
  selector: 'cd-carbon-table',
  templateUrl: './carbon-table.component.html',
  styleUrls: ['./carbon-table.component.scss']
})
export class CarbonTableComponent implements OnInit {
  dataModel!: TableModel;
  loadingIndicator: boolean = false;

  constructor() {
    this.dataModel = new TableModel();
  }

  @Input() title!: string;
  @Input() description!: string;
  @Input() toolHeader: boolean = true;
  @Input() set data(value: any[]) {
    console.log(value);
    this.dataModel.data = [this.createTableItems(value)];
  }
  @Output() fetchData = new EventEmitter<CdTableFetchDataContext>();

  ngOnInit(): void {
    // this.dataModel.data = [
    //   [new TableItem({ data: { name: 'Alanis', email: 'alanis@warner.com' } })]
    // ];
    const context = new CdTableFetchDataContext(() => {
      // Do we have to display the error panel?
      if (!!context.errorConfig.displayError) {
        // this.status = new TableStatus('danger', $localize`Failed to load data.`);
      }
      // Force data table to show no data?
      if (context.errorConfig.resetData) {
        this.data = [];
      }
      // Stop the loading indicator and reset the data table
      // to the correct state.
      // this.useData();
    });
    // context.pageInfo.offset = this.userConfig.offset;
    // context.pageInfo.limit = this.userConfig.limit;
    // context.search = this.userConfig.search;
    // if (this.userConfig.sorts?.length) {
    //   const sort = this.userConfig.sorts[0];
    //   context.sort = `${sort.dir === 'desc' ? '-' : '+'}${sort.prop}`;
    // }
    this.fetchData.emit(context);
  }

  createTableItems(items: any[]): TableItem[] {
    return items.map((item) => new TableItem({ data: item }));
  }
}
