import { Component, Input, OnChanges, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AbstractControl, Validators } from '@angular/forms';

import { TreeViewComponent } from 'carbon-components-angular';
import { Node } from 'carbon-components-angular/treeview/tree-node.types';
import _ from 'lodash';
import moment from 'moment';

import { CephfsService } from '~/app/shared/api/cephfs.service';
import { ConfirmationModalComponent } from '~/app/shared/components/confirmation-modal/confirmation-modal.component';
import { CriticalConfirmationModalComponent } from '~/app/shared/components/critical-confirmation-modal/critical-confirmation-modal.component';
import { FormModalComponent } from '~/app/shared/components/form-modal/form-modal.component';
import { ActionLabelsI18n } from '~/app/shared/constants/app.constants';
import { CellTemplate } from '~/app/shared/enum/cell-template.enum';
import { Icons } from '~/app/shared/enum/icons.enum';
import { NotificationType } from '~/app/shared/enum/notification-type.enum';
import { CdValidators } from '~/app/shared/forms/cd-validators';
import { CdFormModalFieldConfig } from '~/app/shared/models/cd-form-modal-field-config';
import { CdTableAction } from '~/app/shared/models/cd-table-action';
import { CdTableColumn } from '~/app/shared/models/cd-table-column';
import { CdTableSelection } from '~/app/shared/models/cd-table-selection';
import {
  CephfsDir,
  CephfsQuotas,
  CephfsSnapshot
} from '~/app/shared/models/cephfs-directory-models';
import { Permission } from '~/app/shared/models/permissions';
import { CdDatePipe } from '~/app/shared/pipes/cd-date.pipe';
import { DimlessBinaryPipe } from '~/app/shared/pipes/dimless-binary.pipe';
import { AuthStorageService } from '~/app/shared/services/auth-storage.service';
import { ModalCdsService } from '~/app/shared/services/modal-cds.service';
import { NotificationService } from '~/app/shared/services/notification.service';

class QuotaSetting {
  row: {
    // Used in quota table
    name: string;
    value: number | string;
    originPath: string;
  };
  quotaKey: string;
  dirValue: number;
  nextTreeMaximum: {
    value: number;
    path: string;
  };
}

type TQuotaSettings = 'max_bytes' | 'max_files';

@Component({
  selector: 'cd-cephfs-directories',
  templateUrl: './cephfs-directories.component.html',
  styleUrls: ['./cephfs-directories.component.scss']
})
export class CephfsDirectoriesComponent implements OnInit, OnChanges {
  @ViewChild(TreeViewComponent)
  treeComponent: TreeViewComponent;
  @ViewChild('origin', { static: true })
  originTmpl: TemplateRef<any>;

  @Input()
  id: number;

  private dirs: CephfsDir[];
  private nodeIds: { [path: string]: CephfsDir };
  private requestedPaths: string[];
  private loadingTimeout: any;

  icons = Icons;
  loadingIndicator = false;
  loading: Record<string, boolean> = {};
  // treeOptions: ITreeOptions = {
  //   useVirtualScroll: true,
  //   getChildren: (node: TreeNode): Promise<any[]> => {
  //     return this.updateDirectory(node.id);
  //   },
  //   actionMapping: {
  //     mouse: {
  //       click: this.selectAndShowNode.bind(this),
  //       expanderClick: this.selectAndShowNode.bind(this)
  //     }
  //   }
  // };

  permission: Permission;
  selectedDir: CephfsDir;
  settings: QuotaSetting[];
  quota: {
    columns: CdTableColumn[];
    selection: CdTableSelection;
    tableActions: CdTableAction[];
    updateSelection: Function;
  };
  snapshot: {
    columns: CdTableColumn[];
    selection: CdTableSelection;
    tableActions: CdTableAction[];
    updateSelection: Function;
  };

  set cache(value: Node[]) {
    this._cache = this._cache.concat(value);
    this.nodes = this._cache;
  }

  get cache() {
    return this._cache;
  }

  set nodes(value: Node[]) {
    const tree = this.createTreeFromNodes(value);
    this._nodes = tree;
  }
  get nodes(): Node[] {
    return this._nodes;
  }
  private _nodes: Node[] = [];

  private _cache: Node[] = [];

  alreadyExists: boolean;

  constructor(
    private authStorageService: AuthStorageService,
    private modalService: ModalCdsService,
    private cephfsService: CephfsService,
    private cdDatePipe: CdDatePipe,
    private actionLabels: ActionLabelsI18n,
    private notificationService: NotificationService,
    private dimlessBinaryPipe: DimlessBinaryPipe
  ) {}

  // private selectAndShowNode(tree: TreeModel, node: TreeNode, $event: any) {
  //   TREE_ACTIONS.TOGGLE_EXPANDED(tree, node, $event);
  //   this.selectNode(node);
  // }

  async selectNode(node: Node) {
    // TREE_ACTIONS.TOGGLE_ACTIVE(undefined, node, undefined);
    this.selectedDir = this.getDirectory(node);
    if (node.id === '/') {
      return;
    }
    this.cache = await this.updateDirectory(node.value);
    this.setSettings(node);
  }

  ngOnInit() {
    this.permission = this.authStorageService.getPermissions().cephfs;
    this.setUpQuotaTable();
    this.setUpSnapshotTable();
  }

  private setUpQuotaTable() {
    this.quota = {
      columns: [
        {
          prop: 'row.name',
          name: $localize`Name`,
          flexGrow: 1
        },
        {
          prop: 'row.value',
          name: $localize`Value`,
          sortable: false,
          flexGrow: 1
        },
        {
          prop: 'row.originPath',
          name: $localize`Origin`,
          sortable: false,
          cellTemplate: this.originTmpl,
          flexGrow: 1
        }
      ],
      selection: new CdTableSelection(),
      updateSelection: (selection: CdTableSelection) => {
        this.quota.selection = selection;
      },
      tableActions: [
        {
          name: this.actionLabels.SET,
          icon: Icons.edit,
          permission: 'update',
          visible: (selection) =>
            !selection.hasSelection || (selection.first() && selection.first().dirValue === 0),
          click: () => this.updateQuotaModal()
        },
        {
          name: this.actionLabels.UPDATE,
          icon: Icons.edit,
          permission: 'update',
          visible: (selection) => selection.first() && selection.first().dirValue > 0,
          click: () => this.updateQuotaModal()
        },
        {
          name: this.actionLabels.UNSET,
          icon: Icons.destroy,
          permission: 'update',
          disable: (selection) =>
            !selection.hasSelection || (selection.first() && selection.first().dirValue === 0),
          click: () => this.unsetQuotaModal()
        }
      ]
    };
  }

  private setUpSnapshotTable() {
    this.snapshot = {
      columns: [
        {
          prop: 'name',
          name: $localize`Name`,
          flexGrow: 1
        },
        {
          prop: 'path',
          name: $localize`Path`,
          flexGrow: 1.5,
          cellTransformation: CellTemplate.path
        },
        {
          prop: 'created',
          name: $localize`Created`,
          flexGrow: 1,
          pipe: this.cdDatePipe
        }
      ],
      selection: new CdTableSelection(),
      updateSelection: (selection: CdTableSelection) => {
        this.snapshot.selection = selection;
      },
      tableActions: [
        {
          name: this.actionLabels.CREATE,
          icon: Icons.add,
          permission: 'create',
          canBePrimary: (selection) => !selection.hasSelection,
          click: () => this.createSnapshot(),
          disable: () => this.disableCreateSnapshot()
        },
        {
          name: this.actionLabels.DELETE,
          icon: Icons.destroy,
          permission: 'delete',
          click: () => this.deleteSnapshotModal(),
          canBePrimary: (selection) => selection.hasSelection,
          disable: (selection) => !selection.hasSelection
        }
      ]
    };
  }

  private disableCreateSnapshot(): string | boolean {
    const folders = this.selectedDir.path.split('/').slice(1);
    // With depth of 4 or more we have the subvolume files/folders for which we cannot create
    // a snapshot. Somehow, you can create a snapshot of the subvolume but not its files.
    if (folders.length >= 4 && folders[0] === 'volumes') {
      return $localize`Cannot create snapshots for files/folders in the subvolume ${folders[2]}`;
    }
    return false;
  }

  ngOnChanges() {
    this.selectedDir = undefined;
    this.dirs = [];
    this.requestedPaths = [];
    this.nodeIds = {};
    if (this.id) {
      this.setRootNode();
      this.firstCall();
    }
  }

  private setRootNode() {
    this.cache = [
      {
        id: '/',
        label: '/',
        value: '/',
        name: '/',
        isExpanded: true
      }
    ];
  }

  private firstCall() {
    const path = '/';
    setTimeout(async () => {
      // this.getNode(path).loadNodeChildren();
      this.cache = await this.updateDirectory(path);
    }, 10);
  }

  updateDirectory(path: string): Promise<Node[]> {
    this.unsetLoadingIndicator();
    if (!this.requestedPaths.includes(path)) {
      this.requestedPaths.push(path);
    } else if (this.loading[path] === true) {
      return undefined; // Path is currently fetched.
    }
    return new Promise((resolve) => {
      this.setLoadingIndicator(path, true);
      this.cephfsService.lsDir(this.id, path).subscribe((dirs) => {
        this.updateTreeStructure(dirs);
        this.updateQuotaTable();
        // this.updateTree();
        resolve(this.getChildren(path));
        this.setLoadingIndicator(path, false);

        // if (path === '/' && this.treeComponent.treeModel.activeNodes?.length === 0) {
        if (path === '/' && this.cache.some((x) => x.active)) {
          // this.selectNode(this.getNode('/'));
          this.treeComponent.select.emit(this.getNode('/'));
        }
      });
    });
  }

  private setLoadingIndicator(path: string, loading: boolean) {
    this.loading[path] = loading;
    this.unsetLoadingIndicator();
  }

  private getSubDirectories(path: string, tree: CephfsDir[] = this.dirs): CephfsDir[] {
    return tree.filter((d) => d.parent === path);
  }

  private getChildren(path: string): Node[] {
    const subTree = this.getSubTree(path);
    return _.sortBy(this.getSubDirectories(path), 'path').map((dir) =>
      this.createNode(dir, subTree)
    );
  }

  createNode(dir: CephfsDir, subTree?: CephfsDir[]): Node {
    this.nodeIds[dir.path] = dir;
    if (!subTree) {
      this.getSubTree(dir.parent);
    }

    if (dir.path === '/volumes') {
      // const innerNode = this.treeComponent.treeModel.getNodeById('/volumes');
      const innerNode = this.findNode('/volumes', this.cache);
      if (innerNode) {
        // innerNode.expand();
        this.treeComponent.select.emit(innerNode);
      }
    }
    const children = this.getSubDirectories(dir.path, subTree).map(this.toNode);
    return {
      name: dir.name,
      label: dir.name,
      id: dir.path,
      value: dir.path,
      parent: dir?.parent,
      children: children,
      hasChildren: children.length > 0
    };
  }

  private getSubTree(path: string): CephfsDir[] {
    return this.dirs.filter((d) => d.parent && d.parent.startsWith(path));
  }

  private setSettings(node: Node) {
    const readable = (value: number, fn?: (arg0: number) => number | string): number | string =>
      value ? (fn ? fn(value) : value) : '';

    this.settings = [
      this.getQuota(node, 'max_files', readable),
      this.getQuota(node, 'max_bytes', (value) =>
        readable(value, (v) => this.dimlessBinaryPipe.transform(v))
      )
    ];
  }

  private getQuota(
    tree: Node,
    quotaKey: TQuotaSettings,
    valueConvertFn: (number: number) => number | string
  ): QuotaSetting {
    // Get current maximum
    const currentPath = tree.id;
    tree = this.getOrigin(tree, quotaKey);
    const dir = this.getDirectory(tree);
    const value = dir.quotas[quotaKey];
    // Get next tree maximum
    // => The value that isn't changeable through a change of the current directories quota value
    let nextMaxValue = value;
    let nextMaxPath = dir.path;
    if (tree.id === currentPath) {
      if (tree?.parent === '/') {
        // The value will never inherit any other value, so it has no maximum.
        nextMaxValue = 0;
      } else {
        const parent = this.getParent(tree?.parent);
        console.log('tree:', tree);
        console.log('parent:', parent);
        const nextMaxDir = this.getDirectory(this.getOrigin(parent, quotaKey));
        nextMaxValue = nextMaxDir.quotas[quotaKey];
        nextMaxPath = nextMaxDir.path;
      }
    }
    return {
      row: {
        name: quotaKey === 'max_bytes' ? $localize`Max size` : $localize`Max files`,
        value: valueConvertFn(value),
        originPath: value ? dir.path : ''
      },
      quotaKey,
      dirValue: this.nodeIds[currentPath].quotas[quotaKey],
      nextTreeMaximum: {
        value: nextMaxValue,
        path: nextMaxValue ? nextMaxPath : ''
      }
    };
  }

  /**
   * Get the node where the quota limit originates from in the current node
   *
   * Example as it's a recursive method:
   *
   * |  Path + Value | Call depth |       useOrigin?      | Output |
   * |:-------------:|:----------:|:---------------------:|:------:|
   * | /a/b/c/d (15) |     1st    | 2nd (5) < 15 => false |  /a/b  |
   * | /a/b/c (20)   |     2nd    | 3rd (5) < 20 => false |  /a/b  |
   * | /a/b (5)      |     3rd    |  4th (10) < 5 => true |  /a/b  |
   * | /a (10)       |     4th    |       10 => true      |   /a   |
   *
   */
  private getOrigin(tree: Node, quotaSetting: TQuotaSettings): Node {
    const parent = this.cache.find((x) => x.value === tree?.parent);
    if (parent && parent.id !== '/') {
      const current = this.getQuotaFromTree(tree, quotaSetting);

      // Get the next used quota and node above the current one (until it hits the root directory)
      const originTree = this.getOrigin(parent, quotaSetting);
      const inherited = this.getQuotaFromTree(originTree, quotaSetting);

      // Select if the current quota is in use or the above
      const useOrigin = current === 0 || (inherited !== 0 && inherited < current);
      return useOrigin ? originTree : tree;
    }
    return tree;
  }

  private getQuotaFromTree(tree: Node, quotaSetting: TQuotaSettings): number {
    return this.getDirectory(tree).quotas[quotaSetting];
  }

  private getDirectory(node: Node): CephfsDir {
    const path = node?.id || node?.value;
    return this.nodeIds[path];
  }

  selectOrigin(path: string) {
    // this.selectNode(this.getNode(path));
    this.treeComponent.select.emit(this.getNode(path));
  }

  private getNode(path: string): Node {
    // return this.treeComponent.treeModel.getNodeById(path);
    return this.findNode(path, this.cache);
  }

  updateQuotaModal() {
    const path = this.selectedDir.path;
    const selection: QuotaSetting = this.quota.selection.first();
    const nextMax = selection.nextTreeMaximum;
    const key = selection.quotaKey;
    const value = selection.dirValue;
    this.modalService.show(FormModalComponent, {
      titleText: this.getModalQuotaTitle(
        value === 0 ? this.actionLabels.SET : this.actionLabels.UPDATE,
        path
      ),
      message: nextMax.value
        ? $localize`The inherited ${this.getQuotaValueFromPathMsg(
            nextMax.value,
            nextMax.path
          )} is the maximum value to be used.`
        : undefined,
      fields: [this.getQuotaFormField(selection.row.name, key, value, nextMax.value)],
      submitButtonText: $localize`Save`,
      onSubmit: (values: CephfsQuotas) => this.updateQuota(values)
    });
  }

  private getModalQuotaTitle(action: string, path: string): string {
    return $localize`${action} CephFS ${this.getQuotaName()} quota for '${path}'`;
  }

  private getQuotaName(): string {
    return this.isBytesQuotaSelected() ? $localize`size` : $localize`files`;
  }

  private isBytesQuotaSelected(): boolean {
    return this.quota.selection.first().quotaKey === 'max_bytes';
  }

  private getQuotaValueFromPathMsg(value: number, path: string): string {
    value = this.isBytesQuotaSelected() ? this.dimlessBinaryPipe.transform(value) : value;

    return $localize`${this.getQuotaName()} quota ${value} from '${path}'`;
  }

  private getQuotaFormField(
    label: string,
    name: string,
    value: number,
    maxValue: number
  ): CdFormModalFieldConfig {
    const isBinary = name === 'max_bytes';
    const formValidators = [isBinary ? CdValidators.binaryMin(0) : Validators.min(0)];
    if (maxValue) {
      formValidators.push(isBinary ? CdValidators.binaryMax(maxValue) : Validators.max(maxValue));
    }
    const field: CdFormModalFieldConfig = {
      type: isBinary ? 'binary' : 'number',
      label,
      name,
      value,
      validators: formValidators,
      required: true
    };
    if (!isBinary) {
      field.errors = {
        min: $localize`Value has to be at least 0 or more`,
        max: $localize`Value has to be at most ${maxValue} or less`
      };
    }
    return field;
  }

  private updateQuota(values: CephfsQuotas, onSuccess?: Function) {
    const path = this.selectedDir.path;
    const key = this.quota.selection.first().quotaKey;
    const action =
      this.selectedDir.quotas[key] === 0
        ? this.actionLabels.SET
        : values[key] === 0
        ? this.actionLabels.UNSET
        : $localize`Updated`;
    this.cephfsService.quota(this.id, path, values).subscribe(() => {
      if (onSuccess) {
        onSuccess();
      }
      this.notificationService.show(
        NotificationType.success,
        this.getModalQuotaTitle(action, path)
      );
      this.forceDirRefresh();
    });
  }

  unsetQuotaModal() {
    const path = this.selectedDir.path;
    const selection: QuotaSetting = this.quota.selection.first();
    const key = selection.quotaKey;
    const nextMax = selection.nextTreeMaximum;
    const dirValue = selection.dirValue;

    const quotaValue = this.getQuotaValueFromPathMsg(nextMax.value, nextMax.path);
    const conclusion =
      nextMax.value > 0
        ? nextMax.value > dirValue
          ? $localize`in order to inherit ${quotaValue}`
          : $localize`which isn't used because of the inheritance of ${quotaValue}`
        : $localize`in order to have no quota on the directory`;

    this.modalService.show(ConfirmationModalComponent, {
      titleText: this.getModalQuotaTitle(this.actionLabels.UNSET, path),
      buttonText: this.actionLabels.UNSET,
      description: $localize`${this.actionLabels.UNSET} ${this.getQuotaValueFromPathMsg(
        dirValue,
        path
      )} ${conclusion}.`,
      onSubmit: () => this.updateQuota({ [key]: 0 }, () => this.modalService.dismissAll())
    });
  }

  createSnapshot() {
    // Create a snapshot. Auto-generate a snapshot name by default.
    const path = this.selectedDir.path;
    this.modalService.show(FormModalComponent, {
      titleText: $localize`Create Snapshot`,
      message: $localize`Please enter the name of the snapshot.`,
      fields: [
        {
          type: 'text',
          name: 'name',
          value: `${moment().toISOString(true)}`,
          required: true,
          validators: [this.validateValue.bind(this)]
        }
      ],
      submitButtonText: $localize`Create Snapshot`,
      onSubmit: (values: CephfsSnapshot) => {
        if (!this.alreadyExists) {
          this.cephfsService.mkSnapshot(this.id, path, values.name).subscribe((name) => {
            this.notificationService.show(
              NotificationType.success,
              $localize`Created snapshot '${name}' for '${path}'`
            );
            this.forceDirRefresh();
          });
        } else {
          this.notificationService.show(
            NotificationType.error,
            $localize`Snapshot name '${values.name}' is already in use. Please use another name.`
          );
        }
      }
    });
  }

  validateValue(control: AbstractControl) {
    this.alreadyExists = this.selectedDir.snapshots.some((s) => s.name === control.value);
  }

  /**
   * Forces an update of the current selected directory
   *
   * As all nodes point by their path on an directory object, the easiest way is to update
   * the objects by merge with their latest change.
   */
  private forceDirRefresh(path?: string) {
    if (!path) {
      const dir = this.selectedDir;
      if (!dir) {
        throw new Error('This function can only be called without path if an selection was made');
      }
      // Parent has to be called in order to update the object referring
      // to the current selected directory
      path = dir.parent ? dir.parent : dir.path;
    }
    const node = this.getNode(path);
    node.loadNodeChildren();
  }

  private updateTreeStructure(dirs: CephfsDir[]) {
    const getChildrenAndPaths = (
      directories: CephfsDir[],
      parent: string
    ): { children: CephfsDir[]; paths: string[] } => {
      const children = directories.filter((d) => d.parent === parent);
      const paths = children.map((d) => d.path);
      return { children, paths };
    };

    const parents = _.uniq(dirs.map((d) => d.parent).sort());
    parents.forEach((p) => {
      const received = getChildrenAndPaths(dirs, p);
      const cached = getChildrenAndPaths(this.dirs, p);

      cached.children.forEach((d) => {
        if (!received.paths.includes(d.path)) {
          this.removeOldDirectory(d);
        }
      });
      received.children.forEach((d) => {
        if (cached.paths.includes(d.path)) {
          this.updateExistingDirectory(cached.children, d);
        } else {
          this.addNewDirectory(d);
        }
      });
    });
  }

  private removeOldDirectory(rmDir: CephfsDir) {
    const path = rmDir.path;
    // Remove directory from local variables
    _.remove(this.dirs, (d) => d.path === path);
    delete this.nodeIds[path];
    this.updateDirectoriesParentNode(rmDir);
  }

  private updateDirectoriesParentNode(dir: CephfsDir) {
    const parent = dir.parent;
    if (!parent) {
      return;
    }
    const node = this.getNode(parent);
    if (!node) {
      // Node will not be found for new sub directories - this is the intended behaviour
      return;
    }
    const children = this.getChildren(parent);
    node.children = children;
    node.hasChildren = children.length > 0;
    // this.treeComponent.treeModel.update();
  }

  private addNewDirectory(newDir: CephfsDir) {
    this.dirs.push(newDir);
    this.nodeIds[newDir.path] = newDir;
    this.updateDirectoriesParentNode(newDir);
  }

  private updateExistingDirectory(source: CephfsDir[], updatedDir: CephfsDir) {
    const currentDirObject = source.find((sub) => sub.path === updatedDir.path);
    Object.assign(currentDirObject, updatedDir);
  }

  private updateQuotaTable() {
    const node = this.selectedDir ? this.getNode(this.selectedDir.path) : undefined;
    if (node && node.id !== '/') {
      this.setSettings(node);
    }
  }

  private updateTree(force: boolean = false) {
    if (this.loadingIndicator && !force) {
      // In order to make the page scrollable during load, the render cycle for each node
      // is omitted and only be called if all updates were loaded.
      return;
    }
    // this.treeComponent.treeModel.update();
    // this.nodes = [...this.nodes];
    // this.treeComponent.sizeChanged();
  }

  deleteSnapshotModal() {
    this.modalService.show(CriticalConfirmationModalComponent, {
      itemDescription: $localize`CephFs Snapshot`,
      itemNames: this.snapshot.selection.selected.map((snapshot: CephfsSnapshot) => snapshot.name),
      submitAction: () => this.deleteSnapshot()
    });
  }

  deleteSnapshot() {
    const path = this.selectedDir.path;
    this.snapshot.selection.selected.forEach((snapshot: CephfsSnapshot) => {
      const name = snapshot.name;
      this.cephfsService.rmSnapshot(this.id, path, name).subscribe(() => {
        this.notificationService.show(
          NotificationType.success,
          $localize`Deleted snapshot '${name}' for '${path}'`
        );
      });
    });
    this.modalService.dismissAll();
    this.forceDirRefresh();
  }

  refreshAllDirectories() {
    // In order to make the page scrollable during load, the render cycle for each node
    // is omitted and only be called if all updates were loaded.
    this.loadingIndicator = true;
    this.requestedPaths.map((path) => this.forceDirRefresh(path));
    const interval = setInterval(() => {
      this.updateTree(true);
      if (!this.loadingIndicator) {
        clearInterval(interval);
      }
    }, 3000);
  }

  unsetLoadingIndicator() {
    if (!this.loadingIndicator) {
      return;
    }
    clearTimeout(this.loadingTimeout);
    this.loadingTimeout = setTimeout(() => {
      const loading = Object.values(this.loading).some((l) => l);
      if (loading) {
        return this.unsetLoadingIndicator();
      }
      this.loadingIndicator = false;
      this.updateTree();
      // The problem is that we can't subscribe to an useful updated tree event and the time
      // between fetching all calls and rebuilding the tree can take some time
    }, 3000);
  }

  findNode(path: string, nodes: Node[]): Node | null {
    for (const node of nodes) {
      if (node.value === path) {
        return node;
      } else if (node?.children?.length) {
        return this.findNode(path, node.children);
      } else {
        continue;
      }
    }
    return null;
  }

  toNode(directory: CephfsDir): Node {
    return {
      id: directory.path,
      label: directory.name,
      value: directory.path,
      children: [],
      parent: directory?.parent
    };
  }

  getChildrenNodes = _.curry(
    <T extends { parent?: string }>(node: T, path: string): boolean => node?.parent === path
  );

  getParent(dir: CephfsDir) {
    const parentNode = this.dirs?.find?.((x) => x.path === dir?.parent);
    return parentNode ? this.toNode(parentNode) : null;
  }

  createTree(directories: CephfsDir[]): Node[] {
    return directories.reduce((tree, directory, _index, directoryArr) => {
      const children = directoryArr.filter(this.getChildrenNodes(directory.path)).map(this.toNode);
      const node = this.toNode(directory);
      node.children = _.uniq([...node?.children, ...children]);
      const exists = this.findNode(node.value, tree);
      if (!exists) tree.push(node);
      return tree;
    }, []);
  }

  /*
  v.reduce((tree, node, _index, arr)=>{
    var children = arr.filter(x => x.parent === node?.value) || [];
    console.log('children found?', children);
    node.children = children;
    var exists = findNode(node.value, tree);
    console.log('already exists?', exists);
    if(!exists && !node?.parent){
        tree.push(node);
    }
    return tree;
},[])
*/
  createTreeFromNodes(nodes: Node[]): Node[] {
    return nodes.reduce((tree, node, _index, nodeArr) => {
      const children = nodeArr.filter((x) => x.parent === node?.value) || [];
      console.log('children found?', children);
      node.children = children;
      var exists = this.findNode(node.value, tree);
      console.log('already exists?', exists);
      if (!exists && !node?.parent) {
        tree.push(node);
      }
      return tree;
    }, []);
  }
}
