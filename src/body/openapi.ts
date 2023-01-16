export const OpenAPI = ({ title, description, version, paths }) => ({
	openapi: '3.1.0',
	info: { title, description, version },
	paths,
});
