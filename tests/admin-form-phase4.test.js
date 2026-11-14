'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file, stagingFile = file) => {
  const actualPath = path.join(__dirname, '..', file);
  const stagingPath = path.join(__dirname, '..', '.phase4', stagingFile);
  return fs.readFileSync(fs.existsSync(actualPath) ? actualPath : stagingPath, 'utf8');
};

const views = {
  categoryCreate: read('views/admin/categories/create_categoria.ejs', 'create_categoria.ejs'),
  categoryUpdate: read('views/admin/categories/update_category.ejs', 'update_category.ejs'),
  roleCreate: read('views/admin/rols/create_rol.ejs', 'create_rol.ejs'),
  roleUpdate: read('views/admin/rols/update_roles.ejs', 'update_roles.ejs'),
  providerCreate: read('views/admin/providers/create_proveedor.ejs', 'create_proveedor.ejs'),
  providerUpdate: read('views/admin/providers/update_provider.ejs', 'update_provider.ejs'),
};

test('las seis vistas conservan sus formularios y rutas administrativas', () => {
  assert.match(views.categoryCreate, /class="page-wrapper"/);
  assert.match(views.categoryUpdate, /class="page-wrapper"/);
  assert.match(views.categoryCreate, /class="form-card ui-card ui-card--form small-card"/);
  assert.match(views.categoryUpdate, /class="form-card ui-card ui-card--form small-card"/);
  assert.match(views.categoryCreate, /action="\/create-categoria"/);
  assert.match(views.categoryUpdate, /action="\/update-categoria\/<%= category\._id %>"/);

  assert.match(views.roleCreate, /class="page-wrapper"/);
  assert.match(views.roleUpdate, /class="page-wrapper"/);
  assert.match(views.roleCreate, /class="form-card ui-card ui-card--form small-card"/);
  assert.match(views.roleUpdate, /class="form-card ui-card ui-card--form small-card"/);
  assert.match(views.roleCreate, /action="\/create-rol"/);
  assert.match(views.roleUpdate, /action="\/update-rol"/);

  assert.match(views.providerCreate, /class="page-wrapper"/);
  assert.match(views.providerUpdate, /class="page-wrapper"/);
  assert.match(views.providerCreate, /action="\/create-proveedor"/);
  assert.match(views.providerUpdate, /action="\/update-proveedor\/<%= provider\._id %>"/);

  Object.values(views).forEach((source) => {
    assert.match(source, /name="_csrf"/);
    assert.match(source, /class="form-actions"/);
  });
});

test('los formularios de roles mantienen permisos y protección de roles del sistema', () => {
  assert.match(views.roleCreate, /permissionKeys/);
  assert.match(views.roleCreate, /permissionLabels\[permission\]/);
  assert.match(views.roleCreate, /name="permisos"/);
  assert.match(views.roleUpdate, /const systemRole = \['Admin', 'Cliente', 'dealer'\]/);
  assert.match(views.roleUpdate, /systemRole \? 'disabled' : ''/);
  assert.match(views.roleUpdate, /href="\/read-rol"/);
  assert.match(views.roleUpdate, /name="id" value="<%= rol\._id %>"/);
});

test('los formularios de proveedores mantienen campos y validación del plazo', () => {
  [views.providerCreate, views.providerUpdate].forEach((source) => {
    assert.match(source, /name="nombre"/);
    assert.match(source, /name="telefono"/);
    assert.match(source, /name="direccion"/);
    assert.match(source, /name="diasEntrega"/);
    assert.match(source, /min="0"/);
    assert.match(source, /max="365"/);
    assert.match(source, /step="1"/);
    assert.match(source, /name="descripcion"/);
    assert.match(source, /required/);
  });
  assert.match(views.providerCreate, /name="contacto"/);
  assert.match(views.providerCreate, /name="email"/);
});

test('las hojas de estilo fijan anchos, centrado y comportamiento responsive', () => {
  const styles = {
    categoryCreate: read('public/css/create_categories.css', 'create_categories.css'),
    categoryUpdate: read('public/css/update_categories.css', 'update_categories.css'),
    roleCreate: read('public/css/create_roles.css', 'create_roles.css'),
    roleUpdate: read('public/css/update_roles.css', 'update_roles.css'),
    providerCreate: read('public/css/create_providers.css', 'create_providers.css'),
    providerUpdate: read('public/css/update_providers.css', 'update_providers.css'),
  };

  ['categoryCreate', 'categoryUpdate'].forEach((name) => {
    assert.match(styles[name], /max-width: 700px/);
    assert.match(styles[name], /margin: 40px auto/);
  });

  ['roleCreate', 'roleUpdate', 'providerCreate', 'providerUpdate'].forEach((name) => {
    assert.match(styles[name], /max-width: 900px/);
    assert.match(styles[name], /margin: 40px auto/);
  });

  ['roleCreate', 'roleUpdate'].forEach((name) => {
    assert.match(styles[name], /\.permission-grid/);
    assert.match(styles[name], /grid-template-columns/);
    assert.match(styles[name], /@media \(max-width: 620px\)/);
  });

  ['providerCreate', 'providerUpdate'].forEach((name) => {
    assert.match(styles[name], /\.provider-form \.form-grid/);
    assert.match(styles[name], /\.form-group\.full/);
    assert.match(styles[name], /@media \(max-width: 680px\)/);
  });
});
