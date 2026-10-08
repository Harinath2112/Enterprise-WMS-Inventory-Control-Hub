"""Response envelope identical to the C# ApiResponse<T>: {success, data, message, errors, traceId, error}."""
import uuid
from rest_framework import status
from rest_framework.exceptions import (APIException, AuthenticationFailed, NotAuthenticated, PermissionDenied,
                                       ValidationError, NotFound, MethodNotAllowed, ParseError)
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.utils.encoders import JSONEncoder


class _Encoder(JSONEncoder):
    def default(self, o):
        from decimal import Decimal
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


class IMSJSONRenderer(JSONRenderer):
    encoder_class = _Encoder


def _trace():
    return uuid.uuid4().hex[:16]


def ok(data=None, message=None, code=200):
    return Response({"success": True, "data": data, "message": message, "errors": None, "traceId": _trace(),
                     "error": message}, status=code)


def fail(message, code=400, errors=None):
    return Response({"success": False, "data": None, "message": message, "errors": errors or {},
                     "traceId": _trace(), "error": message}, status=code)


class ApiError(Exception):
    def __init__(self, message, code=400, errors=None):
        super().__init__(message); self.message, self.code, self.errors = message, code, errors


def exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return fail(exc.message, exc.code, exc.errors)
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return fail(str(exc.detail) if isinstance(exc, AuthenticationFailed) else "Authentication is required.", 401)
    if isinstance(exc, PermissionDenied):
        return fail("You do not have permission to perform this action.", 403)
    if isinstance(exc, NotFound):
        return fail("The requested resource was not found.", 404)
    if isinstance(exc, ValidationError):
        return fail("Validation failed.", 400, {"detail": [str(exc.detail)]})
    if isinstance(exc, (MethodNotAllowed, ParseError)):
        return fail(str(exc.detail), exc.status_code)
    if isinstance(exc, APIException):
        return fail(str(exc.detail), exc.status_code)
    import logging
    logging.getLogger("ims").exception("Unhandled error")
    return fail("An unexpected error occurred. Please try again.", 500)
