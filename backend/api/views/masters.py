"""Master data: brands, units, categories, sub-categories, attributes, attribute values, variants."""
from rest_framework.decorators import api_view

from ..core.crud import make_crud, CrudBase, ListCreate, Detail
from ..core.response import ApiError, ok
from ..core.serial import to_dict
from ..models import (AttributeValues, Attributes, Brands, Categories, Products, SubCategories, Units, VariantAttributeValues,
                      ProductVariants)

BrandList, BrandDetail = make_crud(Brands, "Brand", module="Brands", order=["name"], search=["name", "description"],
                                   unique=["name"], required=[("name", "Brand name is required.")])
UnitList, UnitDetail = make_crud(Units, "Unit", module="Units", order=["name"], search=["name", "short_name"],
                                 unique=["name"], required=[("name", "Unit name is required.")])


class _CategoryMixin:
    def bulk_extra(self, objs):
        return {}

    def before_delete(self, request, obj):
        if Products.objects.filter(category_id=obj.pk, is_deleted=False).exists():
            raise ApiError("This category is used by products and cannot be deleted.")
        if SubCategories.objects.filter(category_id=obj.pk, is_deleted=False).exists() or Categories.objects.filter(parent_id=obj.pk, is_deleted=False).exists():
            raise ApiError("This category has sub-categories and cannot be deleted.")


CategoryList, CategoryDetail = make_crud(Categories, "Category", module="Categories", order=["name"], search=["name", "description"],
                                         unique=["name"], required=[("name", "Category name is required.")],
                                         before_delete=_CategoryMixin.before_delete)


@api_view(["GET"])
def categories_main(request):
    return ok([to_dict(c) for c in Categories.objects.filter(is_deleted=False, parent_id__isnull=True).order_by("name")])


@api_view(["GET"])
def categories_sub(request, parent_id):
    return ok([to_dict(c) for c in Categories.objects.filter(is_deleted=False, parent_id=parent_id).order_by("name")])


def _sub_extra(objs):
    names = {c.pk: c.name for c in Categories.objects.filter(pk__in={o.category_id for o in objs})}
    return {o.pk: {"categoryName": names.get(o.category_id)} for o in objs}


def _sub_delete(self, request, obj):
    if Products.objects.filter(sub_category_id=obj.pk, is_deleted=False).exists():
        raise ApiError("This sub-category is used by products and cannot be deleted.")


SubCategoryList, SubCategoryDetail = make_crud(SubCategories, "Sub-category", module="SubCategories", order=["name"],
                                               search=["name", "description"], required=[("name", "Sub-category name is required.")],
                                               bulk_extra=staticmethod(_sub_extra), before_delete=_sub_delete)

AttributeList, AttributeDetail = make_crud(Attributes, "Attribute", module="Attributes", order=["name"], search=["name"],
                                           unique=["name"], required=[("name", "Attribute name is required.")])
AttributeValueList, AttributeValueDetail = make_crud(AttributeValues, "Attribute value", module="Attributes", order=["value"], search=["value"],
                                                     required=[("value", "Attribute value is required.")])


@api_view(["GET"])
def attribute_values_by_attribute(request, attribute_id):
    return ok([to_dict(v) for v in AttributeValues.objects.filter(attribute_id=attribute_id).order_by("value")])


VariantAttrList, VariantAttrDetail = make_crud(VariantAttributeValues, "Variant attribute", module="Product Variants")


@api_view(["GET"])
def variant_attributes_by_variant(request, variant_id):
    rows = VariantAttributeValues.objects.filter(variant_id=variant_id)
    attrs = {a.pk: a.name for a in Attributes.objects.all()}
    vals = {v.pk: v.value for v in AttributeValues.objects.all()}
    return ok([to_dict(r, extra={"attributeName": attrs.get(r.attribute_id), "value": vals.get(r.value_id)}) for r in rows])


def _variant_extra(objs):
    prods = {p.pk: p.name for p in Products.objects.filter(pk__in={o.product_id for o in objs})}
    attrs = {a.pk: a.name for a in Attributes.objects.all()}
    vals = {v.pk: v.value for v in AttributeValues.objects.all()}
    links = {}
    for r in VariantAttributeValues.objects.filter(variant_id__in=[o.pk for o in objs]):
        links.setdefault(r.variant_id, []).append({"attributeId": r.attribute_id, "attributeName": attrs.get(r.attribute_id),
                                                    "valueId": r.value_id, "value": vals.get(r.value_id)})
    return {o.pk: {"productName": prods.get(o.product_id), "attributes": links.get(o.pk, [])} for o in objs}


class VariantMixin:
    def _sync_attributes(self, obj, data):
        attrs = data.get("attributes") or data.get("attributeValues")
        if not isinstance(attrs, list):
            return
        VariantAttributeValues.objects.filter(variant_id=obj.pk).delete()
        for a in attrs:
            aid = a.get("attributeId") or a.get("AttributeId"); vid = a.get("valueId") or a.get("ValueId") or a.get("attributeValueId")
            if aid:
                VariantAttributeValues.objects.create(variant_id=obj.pk, attribute_id=int(aid), value_id=int(vid) if vid else None)

    def after_save(self, request, obj, data, is_new):
        self._sync_attributes(obj, data)

    def before_delete(self, request, obj):
        VariantAttributeValues.objects.filter(variant_id=obj.pk).delete()


VariantList, VariantDetail = make_crud(ProductVariants, "Product variant", module="Product Variants", order=["variant_name"],
                                       search=["variant_name", "sku"], bulk_extra=staticmethod(_variant_extra),
                                       required=[("variant_name", "Variant name is required.")],
                                       after_save=VariantMixin.after_save, before_delete=VariantMixin.before_delete,
                                       _sync_attributes=VariantMixin._sync_attributes)
