"""Load the data rows of a MySQL dump (e.g. 'imsdatabase.sql') into the configured database through the Django models.
Handy for the zero-setup SQLite mode:  DB_ENGINE=sqlite python manage.py migrate --run-syncdb && python manage.py load_dump "../database/imsdatabase.sql" """
import re

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from api.models import TABLE_MODELS

ESC = {"0": "\0", "n": "\n", "r": "\r", "t": "\t", "b": "\b", "Z": "\x1a", "'": "'", '"': '"', "\\": "\\", "%": "%", "_": "_"}


def parse_rows(text):
    """Yield lists of python values for each (...) tuple of a VALUES clause."""
    i, n = 0, len(text)
    while i < n:
        while i < n and text[i] in " \n\r\t,":
            i += 1
        if i >= n or text[i] != "(":
            break
        i += 1
        row = []
        while True:
            while text[i] in " \n\r\t":
                i += 1
            c = text[i]
            if c == "'":
                i += 1; buf = []
                while True:
                    ch = text[i]
                    if ch == "\\":
                        buf.append(ESC.get(text[i + 1], text[i + 1])); i += 2
                    elif ch == "'":
                        if text[i + 1:i + 2] == "'":
                            buf.append("'"); i += 2
                        else:
                            i += 1; break
                    else:
                        buf.append(ch); i += 1
                row.append("".join(buf))
            else:
                if text.startswith("_binary", i):
                    i += 7
                    while text[i] == " ":
                        i += 1
                    if text[i] == "'":                 # _binary '\0'  -> bit value
                        j = i + 1; buf = []
                        while text[j] != "'":
                            if text[j] == "\\":
                                buf.append(ESC.get(text[j + 1], text[j + 1])); j += 2
                            else:
                                buf.append(text[j]); j += 1
                        i = j + 1
                        row.append(any(ord(ch) for ch in buf)); 
                        while text[i] in " \n\r\t":
                            i += 1
                        if text[i] == ",": i += 1; continue
                        if text[i] == ")": i += 1; break
                        continue
                j = i
                while text[j] not in ",)":
                    j += 1
                tok = text[i:j].strip(); i = j
                if tok.upper() == "NULL": row.append(None)
                else:
                    try: row.append(int(tok))
                    except ValueError:
                        try: row.append(float(tok))
                        except ValueError: row.append(tok)
            while text[i] in " \n\r\t":
                i += 1
            if text[i] == ",":
                i += 1; continue
            if text[i] == ")":
                i += 1; break
        yield row


class Command(BaseCommand):
    help = "Import table data from a MySQL dump file"

    def add_arguments(self, parser):
        parser.add_argument("path")
        parser.add_argument("--wipe", action="store_true", help="delete existing rows in each loaded table first")

    def handle(self, *args, **opts):
        sql = open(opts["path"], encoding="utf8", errors="replace").read()
        total = 0
        with transaction.atomic():
            for m in re.finditer(r"INSERT INTO `(\w+)` VALUES (.*?);\n", sql, re.S):
                table, body = m.group(1), m.group(2)
                model = TABLE_MODELS.get(table)
                if not model:
                    continue
                fields = list(model._meta.concrete_fields)
                if opts["wipe"]:
                    model.objects.all().delete()
                objs = []
                for row in parse_rows(body):
                    if len(row) != len(fields):
                        self.stderr.write(f"skip {table}: {len(row)} values for {len(fields)} columns"); objs = []; break
                    data = {}
                    for f, v in zip(fields, row):
                        if getattr(f, "generated", False):
                            continue
                        data[f.attname] = f.to_python(v) if v is not None and not isinstance(v, bool) else v
                    objs.append(model(**data))
                if objs:
                    model.objects.bulk_create(objs, batch_size=200)
                    total += len(objs)
                    self.stdout.write(f"{table}: {len(objs)} rows")
        self.stdout.write(self.style.SUCCESS(f"Loaded {total} rows."))
