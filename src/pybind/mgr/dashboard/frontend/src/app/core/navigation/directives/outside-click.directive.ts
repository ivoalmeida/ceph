import { Directive, HostListener } from '@angular/core';
import { HeaderAction } from 'carbon-components-angular';

@Directive({
  selector: '[cdOutsideClick]'
})
export class OutsideClickDirective {
  constructor(private el: HeaderAction) {}

  @HostListener('click')
  onClick() {
    this.el.active = true;
  }
  
  @HostListener('document:click')
  onClickOutside() {
    this.el.active = false;
  }
}
