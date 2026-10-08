import os
from datetime import datetime, date
from django.db import models

# Existing MySQL tables are used as-is (managed=False). With DB_ENGINE=sqlite the tables are created for local testing.
MANAGED = os.environ.get("DB_ENGINE", "mysql").lower() == "sqlite" or os.environ.get("IMS_MANAGED") == "1"


def utcnow():
    return datetime.utcnow().replace(microsecond=0)


def today():
    return date.today()


class BitBooleanField(models.BooleanField):
    """MySQL BIT(1) <-> bool (PyMySQL returns bytes for BIT columns)."""

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        if isinstance(value, (bytes, bytearray)):
            return any(value)
        return bool(value)

    def get_db_prep_value(self, value, connection, prepared=False):
        return None if value is None else int(bool(value))
