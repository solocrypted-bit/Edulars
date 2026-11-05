const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EDULARS API',
      version: '1.0.0',
      description:
        'Deployed Node.js backend for EDULARS with MongoDB persistence and role-scoped routes for administration, academics, finance, and school-life modules.'
    },
    servers: [
      {
        url: process.env.API_PUBLIC_URL || '/',
        description: process.env.API_PUBLIC_URL ? 'Deployed API' : 'Current host'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/**/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'EDULARS API Docs'
  }));

  /**
   * @openapi
   * /api-docs-json:
   *   get:
   *     tags: [Operations]
   *     summary: Download the generated OpenAPI document
   *     responses:
   *       200:
   *         description: OpenAPI JSON document
   */
  app.get('/api-docs-json', (req, res) => {
    res.json(swaggerSpec);
  });
}

module.exports = { swaggerSpec, setupSwagger };
