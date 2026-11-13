const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('el cambio de contraseña conserva el contexto visual del rol', () => {
    const controller = read('server/controller/changePasswordController.js');
    const resources = read('server/config/pageResources.js');
    const clientView = read('views/client/auth/change_password.ejs');
    const adminView = read('views/admin/auth/change_password.ejs');
    const dealerView = read('views/dealer/auth/change_password.ejs');

    assert.match(controller, /dealer\/auth\/change_password/);
    assert.match(controller, /admin\/auth\/change_password/);
    assert.match(controller, /hasPermission\(req\.usuarioActual, PERMISSIONS\.ADMIN_ACCESS\)/);
    assert.match(resources, /'admin\/auth\/change_password'/);
    assert.match(resources, /'dealer\/auth\/change_password'/);
    assert.match(clientView, /_header/);
    assert.match(clientView, /_footer/);
    assert.match(adminView, /_headerAdmin/);
    assert.match(adminView, /_footerAdmin/);
    assert.match(dealerView, /_headerDealer/);
    assert.match(dealerView, /_footerDealer/);
});

test('las rutas genéricas de perfil redirigen a la sección correcta', () => {
    const controller = read('server/controller/pages/renderProfile.js');
    const adminProfile = read('views/admin/profile/profile.ejs');
    const dealerProfile = read('views/dealer/profile/profile.ejs');
    const navigation = read('views/include/header/navigation-profile.ejs');

    assert.match(controller, /\/dealer\/perfil/);
    assert.match(controller, /\/admin\/perfil/);
    assert.match(controller, /hasPermission\(req\.usuarioActual, PERMISSIONS\.ADMIN_ACCESS\)/);
    assert.match(controller, /normalizedRole\(user\) === 'admin'/);
    assert.match(controller, /options\.redirectTo/);
    assert.match(adminProfile, /href="\/admin\/perfil\/editar\/\<%= user\._id %\>"/);
    assert.match(dealerProfile, /href="\/dealer\/perfil\/editar"/);
    assert.match(navigation, /headerIsDealer/);
    assert.match(navigation, /headerIsAdmin/);
    assert.match(navigation, /headerPermissions\.includes\('admin:access'\)/);
    assert.match(navigation, /headerCanManageProfile/);
});
