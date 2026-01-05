"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
const zod_1 = require("zod");
const AppError_1 = require("../errors/AppError");
function validateRequest(schema) {
    return async (req, res, next) => {
        try {
            await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const details = error.issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                next(new AppError_1.ValidationError('Validation failed', details));
            }
            else {
                next(error);
            }
        }
    };
}
