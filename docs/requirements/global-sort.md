# global sort

this spec supersede previous 'treeview enhancement' spec

## goal

capability to sort globally items group, allowing to interleave group/milestone/task store in each
group (inc the root). Persistence in a list named "sequence", per group, containing the list of all
id of its direct child, in the selected sequence order

## non goal

bumping document version

## sorting: backend

- Document and group implement a new 'Sortable' interface, introducing the 'sequence' attribute
- it is persisted in file
  - if document or a group do not contain this attribute, it is initialized with the sequence of
    items as the are in the file
  - `sequence` contain **ONLY and ALL direct children** of a group, or, for the document, all items
    not owned by a group

### toolbar

- group all 'new *' actions in a a dropdown action menu

### treeview

- items (group/task/milestone) are displayed accordingly to the sequence
- drag and drop : when one or multiple items are dragged on a task or a list, then
  - then owner become the owner of the drop target (so it is an enhancement of the actual drag &
    drop grouping feature)
  - they ar inserted, in the order sequence, before the drop target

### web view

- in the web view, gantt chart mus display items (inc group) in the order defined by the 'sequence'
