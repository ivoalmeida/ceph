import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CarbonTableComponent } from './carbon-table.component';

describe('CarbonTableComponent', () => {
  let component: CarbonTableComponent;
  let fixture: ComponentFixture<CarbonTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CarbonTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CarbonTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
