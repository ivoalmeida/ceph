import { Component, Input, OnInit } from '@angular/core';
import { TableItem, TableModel } from 'carbon-components-angular';

@Component({
  selector: 'cd-carbon-table',
  templateUrl: './carbon-table.component.html',
  styleUrls: ['./carbon-table.component.scss']
})
export class CarbonTableComponent implements OnInit {
  @Input() title!: string;
  @Input() description!: string;
  @Input() toolHeader: boolean = true;

  dataModel!: TableModel;

  ngOnInit(): void {
    this.dataModel.data = [
      [new TableItem({ data: { name: 'Alanis', email: 'alanis@warner.com' } })]
    ];
  }

  tableItemfactory(items: any[]): TableItem[] {
    return items.map((item) => new TableItem({ data: item }));
  }
}
