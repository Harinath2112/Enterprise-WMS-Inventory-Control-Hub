import re,sys
import os
HERE=os.path.dirname(os.path.abspath(__file__))
SQL=os.path.join(HERE,"..","..","database","imsdatabase.sql")
OUT=os.path.join(HERE,"..","api","models.py")
s=open(SQL,encoding="utf8").read()
tabs=re.findall(r"CREATE TABLE `(\w+)` \((.*?)\n\) ENGINE",s,re.S)
SKIP=lambda t: t.startswith('__') or 'backup' in t
def snake(n):
    x=re.sub(r'([A-Z]+)([A-Z][a-z])',r'\1_\2',n); x=re.sub(r'([a-z0-9])([A-Z])',r'\1_\2',x); return x.lower()
def pascal(t): return ''.join(p.capitalize() for p in t.split('_'))
def default_expr(typ,args,flags,notnull):
    m=re.search(r"DEFAULT ('(?:[^']|'')*'|[\w().]+)",flags); d=m.group(1) if m else None
    if d=='NULL': d=None; has=False
    else: has=d is not None
    if d and d.startswith("'"): d=d[1:-1].replace("''","'")
    if typ in('int','bigint','smallint','tinyint','mediumint') and args!='1':
        if has and re.fullmatch(r'-?\d+',d): return d
        return '0' if notnull else 'None'
    if typ=='tinyint' or typ=='bit': return 'True' if (has and d in('1',"b'1'")) else 'False'
    if typ=='decimal':
        if has and re.fullmatch(r'-?[\d.]+',d): return f"Decimal('{d}')"
        return "Decimal('0')" if notnull else 'None'
    if typ in('datetime','timestamp'):
        if has and 'CURRENT_TIMESTAMP' in d.upper(): return 'utcnow'
        return 'utcnow' if notnull else 'None'
    if typ=='date': return 'today' if notnull and not has else 'None'
    if typ=='enum':
        vals=re.findall(r"'([^']*)'",args)
        return repr(d if has else (vals[0] if notnull else None))
    if has: return repr(d)
    return "''" if notnull else 'None'
out=['"""AUTO-GENERATED from the imsdatabase MySQL schema (see tools/gen_models.py). Maps every table 1:1 so the',
 'existing database works unchanged. Python attributes are snake_case; the real column names are kept via',
 'db_column, and the JSON API uses camelCase of the column name (same contract as the original backend)."""',
 'from decimal import Decimal','from django.db import models','from django.db.models import F','from .core.fieldtypes import BitBooleanField, MANAGED, utcnow, today','',
 'TABLE_MODELS = {}','']
for t,body in tabs:
    if SKIP(t): continue
    cls=pascal(t); fields=[]; pk=None; used=set()
    pkm=re.search(r"PRIMARY KEY \(`(\w+)`\)",body); pkcol=pkm.group(1) if pkm else None
    for line in body.split('\n'):
        m=re.match(r"\s+`(\w+)` (\w+)(?:\(([^)]*)\))?(.*?),?\s*$",line)
        if not m: continue
        col,typ,args,flags=m.groups(); args=args or ''
        notnull='NOT NULL' in flags; auto='AUTO_INCREMENT' in flags
        attr=snake(col)
        gen=re.search(r"GENERATED ALWAYS AS \(\(`(\w+)` ([-+*]) `(\w+)`\)\)",flags)
        if attr in used or attr in('pk','objects','save','delete'): attr+='_val'
        used.add(attr)
        kw=[f"db_column='{col}'"]
        if gen:
            a,op,b=gen.groups(); p_,sc=args.split(',')
            fields.append(f"    {attr} = models.GeneratedField(expression=F('{snake(a)}') {op} F('{snake(b)}'), output_field=models.DecimalField(max_digits={p_}, decimal_places={sc}), db_persist=True, db_column='{col}')"); continue
        if col==pkcol:
            kind='models.AutoField' if auto else ('models.BigAutoField' if typ=='bigint' and auto else 'models.IntegerField')
            if typ=='bigint' and auto: kind='models.BigAutoField'
            if typ=='varchar': kind='models.CharField'; kw.insert(0,f'max_length={args}')
            kw.append('primary_key=True'); fields.append(f"    {attr} = {kind}({', '.join(kw)})"); continue
        d=default_expr(typ,args,flags,notnull)
        null=not notnull
        if typ in('int','smallint','mediumint') or (typ=='tinyint' and args!='1'): kind='models.IntegerField'
        elif typ=='bigint': kind='models.BigIntegerField'
        elif typ=='tinyint' and args=='1': kind='models.BooleanField'
        elif typ=='bit': kind='BitBooleanField'
        elif typ=='decimal':
            p,sc=args.split(','); kind='models.DecimalField'; kw+= [f'max_digits={p}',f'decimal_places={sc}']
        elif typ in('varchar','char'): kind='models.CharField'; kw+=[f'max_length={args}']
        elif typ in('text','longtext','mediumtext','tinytext','json'): kind='models.TextField'
        elif typ=='enum': kind='models.CharField'; kw+=['max_length=64']
        elif typ in('datetime','timestamp'): kind='models.DateTimeField'
        elif typ=='date': kind='models.DateField'
        elif typ=='time': kind='models.TimeField'
        elif typ in('float','double'): kind='models.FloatField'
        else: kind='models.TextField'
        if null: kw.append('null=True'); kw.append('blank=True')
        kw.append(f'default={d}')
        fields.append(f"    {attr} = {kind}({', '.join(kw)})")
    out.append(f"class {cls}(models.Model):"); out+=fields
    out+= ["","    class Meta:",f"        db_table = '{t}'","        managed = MANAGED",""]
    out.append(f"TABLE_MODELS['{t}'] = {cls}"); out.append("")
open(OUT,'w',encoding='utf8').write('\n'.join(out))
print("models:",sum(1 for l in out if l.startswith('class ')))
