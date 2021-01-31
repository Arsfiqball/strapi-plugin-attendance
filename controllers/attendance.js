'use strict';

const { parseMultipartData, sanitizeEntity } = require('strapi-utils');

/**
 * attendance.js controller
 *
 * @description: A set of functions called "actions" of the `attendance` plugin.
 */

module.exports = {
  async punchList (ctx) {
    const plugin = strapi.plugins.attendance;
    const uid = ctx.state.user.id;
    const entities = await plugin.models['attendance-record'].find({ person: uid }).limit(40).sort({ _id: -1 });
    ctx.send(entities);
  },

  async punchIn (ctx) {
    const id = ctx.state.user.id;
    const plugin = strapi.plugins.attendance;
    const upload = strapi.plugins.upload.services.upload;

    let data = ctx.request.body;
    let location;
    let photo;

    if (ctx.is('multipart')) {
      const multipart = parseMultipartData(ctx);
      data = multipart.data;
      photo = multipart.files.photo;
    }

    if (data.location) {
      const [lat, long] = data.location.split(',').map(r => Number(r.trim()).toFixed(8));
      location = [lat, long].join(',');
    }

    const entity = await plugin.models['attendance-record'].create({
      person: id,
      location,
      punchIn: new Date()
    });

    if (photo) {
      const uploaded = await upload.upload({
        files: photo,
        data: {
          refId: entity.id,
          ref: 'attendance-record',
          source: 'attendance',
          field: 'photo',
          fileInfo: {
            name: `Attendance ${ctx.state.user.username} ${(new Date()).toDateString()}`
          }
        }
      });
    }

    return sanitizeEntity(entity, { model: plugin.models['attendance-record'] });
  },

  async punchOut (ctx) {
    const { id } = ctx.params;
    const { note } = ctx.request.body;
    const plugin = strapi.plugins.attendance;
    const entity = await plugin.models['attendance-record'].findById(id);

    if (!entity) return ctx.throw(404);
    if (ctx.state.user.id.toString() !== entity.person.toString()) return ctx.throw(401, 'Wrong person');
    if (entity.punchOut) return ctx.throw(401, 'Punched out already');

    entity.punchOut = new Date();
    entity.note = note;
    await entity.save();

    return sanitizeEntity(entity, { model: plugin.models['attendance-record'] });
  }
};
