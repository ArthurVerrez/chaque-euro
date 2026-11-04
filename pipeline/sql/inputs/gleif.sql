create or replace table gleif_entity_input as
select
    "LEI" as lei,
    regexp_replace("Entity.RegistrationAuthority.RegistrationAuthorityEntityID", '\s', '', 'g') as siren,
    "Entity.EntityStatus" as entity_status,
    "Registration.RegistrationStatus" as registration_status
from read_csv(getvariable('gleif_entity_input_path'), header = true, all_varchar = true)
where "Entity.RegistrationAuthority.RegistrationAuthorityID" in ('RA000189', 'RA000192')
    and regexp_full_match(
        "Entity.RegistrationAuthority.RegistrationAuthorityEntityID",
        '[0-9]{9}|[0-9]{3}\s[0-9]{3}\s[0-9]{3}'
    )
    and "Entity.EntityCategory" = 'GENERAL';

create or replace table gleif_relationship_input as
select
    "Relationship.StartNode.NodeID" as child_lei,
    "Relationship.EndNode.NodeID" as parent_lei,
    "Relationship.RelationshipType" as relationship_type,
    "Relationship.RelationshipStatus" as relationship_status,
    "Registration.RegistrationStatus" as registration_status,
    "Registration.LastUpdateDate" as updated_at,
    list_value(
        struct_pack(kind := "Relationship.Period.1.periodType", starts := "Relationship.Period.1.startDate", ends := "Relationship.Period.1.endDate"),
        struct_pack(kind := "Relationship.Period.2.periodType", starts := "Relationship.Period.2.startDate", ends := "Relationship.Period.2.endDate"),
        struct_pack(kind := "Relationship.Period.3.periodType", starts := "Relationship.Period.3.startDate", ends := "Relationship.Period.3.endDate"),
        struct_pack(kind := "Relationship.Period.4.periodType", starts := "Relationship.Period.4.startDate", ends := "Relationship.Period.4.endDate"),
        struct_pack(kind := "Relationship.Period.5.periodType", starts := "Relationship.Period.5.startDate", ends := "Relationship.Period.5.endDate")
    ) as periods
from read_csv(getvariable('gleif_relationship_input_path'), header = true, all_varchar = true)
where "Relationship.RelationshipType" = 'IS_ULTIMATELY_CONSOLIDATED_BY'
    and "Relationship.StartNode.NodeIDType" = 'LEI'
    and "Relationship.EndNode.NodeIDType" = 'LEI';
