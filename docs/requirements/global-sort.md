# global sort

this spec supersede previous 'treeview enhancement' spec

## goal

capability to sort globally items group, allowing to interleave group/milestone/task store in each
group (inc the root) a list named "sequence", containing the list of all id of its direct child, in
the selected sequence order

## non goal

bumping document version

## sorting

Document and group implement a new 'Sortable' interface 'sequence' attribute is persisted in file if
document or a group do not contain this attribute, it is initialized with defaultSequence this
interface exposed the 'sequence' attribute (readonly,immutable) this sequence contain ONLY and ALL
direct children
